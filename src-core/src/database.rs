use crate::types::EvaluationReport;
use rusqlite::{Connection, OptionalExtension, Result};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    pub fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS cached_projects (
                id INTEGER PRIMARY KEY,
                full_name TEXT NOT NULL UNIQUE,
                evaluation_json TEXT NOT NULL,
                score REAL NOT NULL,
                grade TEXT NOT NULL,
                evaluated_at TEXT NOT NULL,
                github_stars INTEGER,
                track TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY,
                query TEXT NOT NULL,
                result_count INTEGER,
                timestamp TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS evaluation_log (
                id INTEGER PRIMARY KEY,
                repo_full_name TEXT NOT NULL,
                triggered_at TEXT NOT NULL,
                duration_ms INTEGER,
                result_grade TEXT,
                error_message TEXT
            );
            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY,
                full_name TEXT NOT NULL UNIQUE,
                evaluation_json TEXT NOT NULL,
                favorited_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS evaluation_history (
                id INTEGER PRIMARY KEY,
                repo_full_name TEXT NOT NULL,
                evaluation_json TEXT NOT NULL,
                score REAL NOT NULL,
                grade TEXT NOT NULL,
                track TEXT NOT NULL,
                evaluated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_eval_history_repo ON evaluation_history(repo_full_name);
            CREATE INDEX IF NOT EXISTS idx_eval_history_date ON evaluation_history(evaluated_at);
            PRAGMA journal_mode=WAL;",
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn cache_evaluation(&self, report: &EvaluationReport) -> Result<()> {
        let json = serde_json::to_string(report).unwrap_or_default();
        let now = chrono::Utc::now().to_rfc3339();
        let tx = self.conn.unchecked_transaction()?;
        tx.execute(
            "INSERT OR REPLACE INTO cached_projects
             (full_name, evaluation_json, score, grade, evaluated_at, github_stars, track)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (
                &report.repo.full_name,
                &json,
                report.total_score,
                &report.grade,
                &now,
                report.repo.stargazers_count as i64,
                &report.track,
            ),
        )?;

        tx.execute(
            "INSERT INTO evaluation_history
             (repo_full_name, evaluation_json, score, grade, track, evaluated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (
                &report.repo.full_name,
                &json,
                report.total_score,
                &report.grade,
                &report.track,
                &now,
            ),
        )?;

        tx.commit()?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_cached(&self, full_name: &str) -> Result<Option<EvaluationReport>> {
        let json: Option<String> = self
            .conn
            .query_row(
                "SELECT evaluation_json FROM cached_projects WHERE full_name = ?1",
                [full_name],
                |row| row.get(0),
            )
            .optional()?;

        match json {
            Some(j) => Ok(serde_json::from_str(&j).ok()),
            None => Ok(None),
        }
    }

    pub fn log_search(&self, query: &str, result_count: i32) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO search_history (query, result_count, timestamp) VALUES (?1, ?2, ?3)",
            (query, result_count, now),
        )?;
        Ok(())
    }

    pub fn get_search_history(&self, limit: usize) -> Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT query, result_count, timestamp FROM search_history ORDER BY timestamp DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map([limit as i64], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i32>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;

        let mut history = Vec::new();
        for row in rows {
            if let Ok((query, count, timestamp)) = row {
                history.push(serde_json::json!({
                    "query": query,
                    "resultCount": count,
                    "timestamp": timestamp,
                }));
            }
        }
        Ok(history)
    }

    pub fn clear_search_history(&self) -> Result<()> {
        self.conn.execute("DELETE FROM search_history", [])?;
        Ok(())
    }

    pub fn add_favorite(&self, full_name: &str, evaluation_json: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT OR REPLACE INTO favorites (full_name, evaluation_json, favorited_at) VALUES (?1, ?2, ?3)",
            (full_name, evaluation_json, now),
        )?;
        Ok(())
    }

    pub fn remove_favorite(&self, full_name: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM favorites WHERE full_name = ?1",
            [full_name],
        )?;
        Ok(())
    }

    pub fn get_favorites(&self) -> Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT evaluation_json, favorited_at FROM favorites ORDER BY favorited_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
            ))
        })?;

        let mut favorites = Vec::new();
        for row in rows {
            if let Ok((json, favorited_at)) = row {
                if let Ok(report) = serde_json::from_str::<serde_json::Value>(&json) {
                    let mut obj = report;
                    if let Some(map) = obj.as_object_mut() {
                        map.insert("favoritedAt".to_string(), serde_json::Value::String(favorited_at));
                    }
                    favorites.push(obj);
                }
            }
        }
        Ok(favorites)
    }

    pub fn is_favorite(&self, full_name: &str) -> Result<bool> {
        let exists: bool = self.conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM favorites WHERE full_name = ?1)",
            [full_name],
            |row| row.get(0),
        )?;
        Ok(exists)
    }

    #[allow(dead_code)]
    pub fn log_evaluation(
        &self,
        full_name: &str,
        grade: Option<&str>,
        duration_ms: i64,
        error: Option<&str>,
    ) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO evaluation_log (repo_full_name, triggered_at, duration_ms, result_grade, error_message)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (full_name, now, duration_ms, grade.unwrap_or(""), error.unwrap_or("")),
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_recent_cached(&self, limit: usize) -> Result<Vec<EvaluationReport>> {
        let mut stmt = self.conn.prepare(
            "SELECT evaluation_json FROM cached_projects ORDER BY evaluated_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map([limit as i64], |row| row.get::<_, String>(0))?;

        let mut projects = Vec::new();
        for row in rows {
            if let Ok(json) = row {
                if let Ok(report) = serde_json::from_str(&json) {
                    projects.push(report);
                }
            }
        }
        Ok(projects)
    }

    /// 获取项目的评估历史
    pub fn get_evaluation_history(
        &self,
        repo_full_name: &str,
        limit: usize,
    ) -> Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT evaluation_json, score, grade, track, evaluated_at
             FROM evaluation_history
             WHERE repo_full_name = ?1
             ORDER BY evaluated_at DESC
             LIMIT ?2",
        )?;
        let rows = stmt.query_map(rusqlite::params![repo_full_name, limit], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?;

        let mut history = Vec::new();
        for row in rows {
            if let Ok((json, score, grade, track, evaluated_at)) = row {
                if let Ok(mut report) = serde_json::from_str::<serde_json::Value>(&json) {
                    if let Some(map) = report.as_object_mut() {
                        map.insert("historicalScore".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(score).unwrap_or(serde_json::Number::from(0))));
                        map.insert("historicalGrade".to_string(), serde_json::Value::String(grade.clone()));
                        map.insert("historicalTrack".to_string(), serde_json::Value::String(track.clone()));
                        map.insert("historicalEvaluatedAt".to_string(), serde_json::Value::String(evaluated_at.clone()));
                    }
                    history.push(report);
                }
            }
        }
        Ok(history)
    }

    /// 获取项目的评分变化趋势（简化版，只返回关键指标）
    pub fn get_score_trend(&self, repo_full_name: &str) -> Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT score, grade, track, evaluated_at
             FROM evaluation_history
             WHERE repo_full_name = ?1
             ORDER BY evaluated_at ASC",
        )?;
        let rows = stmt.query_map([repo_full_name], |row| {
            Ok((
                row.get::<_, f64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?;

        let mut trend = Vec::new();
        for row in rows {
            if let Ok((score, grade, track, evaluated_at)) = row {
                trend.push(serde_json::json!({
                    "score": score,
                    "grade": grade,
                    "track": track,
                    "evaluatedAt": evaluated_at,
                }));
            }
        }
        Ok(trend)
    }

    /// 清理旧评估历史（保留最近 N 条）
    pub fn prune_evaluation_history(&self, repo_full_name: &str, keep_count: usize) -> Result<()> {
        self.conn.execute(
            "DELETE FROM evaluation_history
             WHERE repo_full_name = ?1
             AND id NOT IN (
                 SELECT id FROM evaluation_history
                 WHERE repo_full_name = ?1
                 ORDER BY evaluated_at DESC
                 LIMIT ?2
             )",
            (repo_full_name, keep_count as i64),
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;
    use crate::evaluator::Evaluator;

    fn test_db() -> Database {
        Database::new(":memory:").expect("Failed to create in-memory database")
    }

    fn mock_report(full_name: &str, score: f64, grade: &str, track: &str) -> EvaluationReport {
        let mut repo = crate::evaluator::tests_helper::mock_repo();
        repo.full_name = full_name.to_string();
        repo.owner = full_name.split('/').next().unwrap_or("test").to_string();
        repo.name = full_name.split('/').last().unwrap_or("repo").to_string();
        let (dimensions, _, _, _) = Evaluator::run_pipeline(&repo, 10, &["L1"; 6]);
        let gate_checks = Evaluator::gate_check(&repo, 10);
        let trust_badge = Evaluator::build_trust_badge(&gate_checks, &dimensions, score);
        EvaluationReport {
            repo,
            one_liner: format!("{} | {}级", full_name, grade),
            track: track.to_string(),
            grade: grade.to_string(),
            total_score: score,
            recommendation_index: 10.0,
            dimensions,
            gate_checks,
            neglect_index: 5.0,
            value_density: Some(1.0),
            steady_state: Some(0.5),
            trust_badge,
            evidence_level: "L1".to_string(),
            veto_flags: vec![],
            confidence_tier: "tier1-core".to_string(),
            decision_trail: vec![],
        }
    }

    #[test]
    fn test_db_init() {
        let db = test_db();
        assert!(db.get_recent_cached(10).is_ok());
    }

    #[test]
    fn test_cache_and_get() {
        let db = test_db();
        let report = mock_report("test/cache-repo", 80.0, "A", "neglected");
        db.cache_evaluation(&report).unwrap();
        let cached = db.get_cached("test/cache-repo").unwrap();
        assert!(cached.is_some());
        let cached_report = cached.unwrap();
        assert!((cached_report.total_score - 80.0).abs() < 0.1);
    }

    #[test]
    fn test_cache_miss() {
        let db = test_db();
        let cached = db.get_cached("nonexistent/repo").unwrap();
        assert!(cached.is_none());
    }

    #[test]
    fn test_cache_overwrite() {
        let db = test_db();
        let report1 = mock_report("test/overwrite", 70.0, "B", "steady");
        db.cache_evaluation(&report1).unwrap();
        let report2 = mock_report("test/overwrite", 85.0, "S", "neglected");
        db.cache_evaluation(&report2).unwrap();
        let cached = db.get_cached("test/overwrite").unwrap().unwrap();
        assert!((cached.total_score - 85.0).abs() < 0.1);
    }

    #[test]
    fn test_search_history() {
        let db = test_db();
        db.log_search("rust logging", 5).unwrap();
        db.log_search("python web", 3).unwrap();
        let history = db.get_search_history(10).unwrap();
        assert_eq!(history.len(), 2);
    }

    #[test]
    fn test_clear_search_history() {
        let db = test_db();
        db.log_search("test", 1).unwrap();
        db.clear_search_history().unwrap();
        let history = db.get_search_history(10).unwrap();
        assert!(history.is_empty());
    }

    #[test]
    fn test_favorites() {
        let db = test_db();
        let report = mock_report("test/fav-repo", 90.0, "S", "neglected");
        let json = serde_json::to_string(&report).unwrap();
        db.add_favorite("test/fav-repo", &json).unwrap();
        assert!(db.is_favorite("test/fav-repo").unwrap());
        let favorites = db.get_favorites().unwrap();
        assert_eq!(favorites.len(), 1);
    }

    #[test]
    fn test_remove_favorite() {
        let db = test_db();
        let report = mock_report("test/remove-fav", 75.0, "B", "steady");
        let json = serde_json::to_string(&report).unwrap();
        db.add_favorite("test/remove-fav", &json).unwrap();
        assert!(db.is_favorite("test/remove-fav").unwrap());
        db.remove_favorite("test/remove-fav").unwrap();
        assert!(!db.is_favorite("test/remove-fav").unwrap());
    }

    #[test]
    fn test_not_favorite() {
        let db = test_db();
        assert!(!db.is_favorite("nonexistent/repo").unwrap());
    }

    #[test]
    fn test_evaluation_history() {
        let db = test_db();
        let report = mock_report("test/history-repo", 80.0, "A", "high-star");
        db.cache_evaluation(&report).unwrap();
        let history = db.get_evaluation_history("test/history-repo", 10).unwrap();
        assert!(!history.is_empty());
    }

    #[test]
    fn test_score_trend() {
        let db = test_db();
        let report = mock_report("test/trend-repo", 75.0, "B", "steady");
        db.cache_evaluation(&report).unwrap();
        let trend = db.get_score_trend("test/trend-repo").unwrap();
        assert!(!trend.is_empty());
    }

    #[test]
    fn test_prune_history() {
        let db = test_db();
        let report = mock_report("test/prune-repo", 70.0, "B", "steady");
        db.cache_evaluation(&report).unwrap();
        db.prune_evaluation_history("test/prune-repo", 1).unwrap();
    }

    #[test]
    fn test_get_recent_cached() {
        let db = test_db();
        let r1 = mock_report("test/recent1", 80.0, "A", "neglected");
        let r2 = mock_report("test/recent2", 75.0, "B", "steady");
        db.cache_evaluation(&r1).unwrap();
        db.cache_evaluation(&r2).unwrap();
        let cached = db.get_recent_cached(10).unwrap();
        assert!(cached.len() >= 2);
    }
}
