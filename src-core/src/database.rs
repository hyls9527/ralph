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
            CREATE TABLE IF NOT EXISTS trend_snapshots (
                id INTEGER PRIMARY KEY,
                repo_full_name TEXT NOT NULL,
                stars INTEGER NOT NULL,
                forks INTEGER NOT NULL,
                open_issues INTEGER NOT NULL,
                snapshot_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_trend_snapshots_repo ON trend_snapshots(repo_full_name);
            CREATE INDEX IF NOT EXISTS idx_trend_snapshots_date ON trend_snapshots(snapshot_at);
            CREATE TABLE IF NOT EXISTS discovery_results (
                id INTEGER PRIMARY KEY,
                repo_full_name TEXT NOT NULL,
                evaluation_json TEXT NOT NULL,
                score REAL NOT NULL,
                grade TEXT NOT NULL,
                track TEXT NOT NULL,
                discovery_query TEXT NOT NULL,
                discovered_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_discovery_repo ON discovery_results(repo_full_name);
            CREATE INDEX IF NOT EXISTS idx_discovery_date ON discovery_results(discovered_at);
            CREATE TABLE IF NOT EXISTS batch_sessions (
                id INTEGER PRIMARY KEY,
                session_id TEXT NOT NULL UNIQUE,
                query TEXT NOT NULL,
                total_repos INTEGER NOT NULL,
                processed INTEGER NOT NULL DEFAULT 0,
                evaluated INTEGER NOT NULL DEFAULT 0,
                skipped INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'running',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS batch_progress (
                id INTEGER PRIMARY KEY,
                session_id TEXT NOT NULL,
                repo_full_name TEXT NOT NULL,
                status TEXT NOT NULL,
                evaluated_at TEXT,
                FOREIGN KEY (session_id) REFERENCES batch_sessions(session_id)
            );
            CREATE INDEX IF NOT EXISTS idx_batch_progress_session ON batch_progress(session_id);
            CREATE INDEX IF NOT EXISTS idx_batch_progress_repo ON batch_progress(repo_full_name);
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

    pub fn save_trend_snapshot(&self, snapshot: &crate::types::TrendSnapshot) -> Result<()> {
        self.conn.execute(
            "INSERT INTO trend_snapshots (repo_full_name, stars, forks, open_issues, snapshot_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                &snapshot.repo_full_name,
                snapshot.stars as i64,
                snapshot.forks as i64,
                snapshot.open_issues as i64,
                &snapshot.snapshot_at,
            ),
        )?;
        Ok(())
    }

    pub fn get_trend_snapshots(
        &self,
        repo_full_name: &str,
        limit: usize,
    ) -> Result<Vec<crate::types::TrendSnapshot>> {
        let mut stmt = self.conn.prepare(
            "SELECT repo_full_name, stars, forks, open_issues, snapshot_at
             FROM trend_snapshots
             WHERE repo_full_name = ?1
             ORDER BY snapshot_at DESC
             LIMIT ?2",
        )?;
        let rows = stmt.query_map(rusqlite::params![repo_full_name, limit as i64], |row| {
            Ok(crate::types::TrendSnapshot {
                repo_full_name: row.get(0)?,
                stars: row.get::<_, i64>(1)? as u32,
                forks: row.get::<_, i64>(2)? as u32,
                open_issues: row.get::<_, i64>(3)? as u32,
                snapshot_at: row.get(4)?,
            })
        })?;

        let mut snapshots = Vec::new();
        for row in rows {
            if let Ok(s) = row {
                snapshots.push(s);
            }
        }
        Ok(snapshots)
    }

    pub fn get_latest_trend_snapshot(
        &self,
        repo_full_name: &str,
    ) -> Result<Option<crate::types::TrendSnapshot>> {
        let mut stmt = self.conn.prepare(
            "SELECT repo_full_name, stars, forks, open_issues, snapshot_at
             FROM trend_snapshots
             WHERE repo_full_name = ?1
             ORDER BY snapshot_at DESC
             LIMIT 1",
        )?;
        let result = stmt.query_row([repo_full_name], |row| {
            Ok(crate::types::TrendSnapshot {
                repo_full_name: row.get(0)?,
                stars: row.get::<_, i64>(1)? as u32,
                forks: row.get::<_, i64>(2)? as u32,
                open_issues: row.get::<_, i64>(3)? as u32,
                snapshot_at: row.get(4)?,
            })
        });

        match result {
            Ok(s) => Ok(Some(s)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn save_discovery_result(
        &self,
        report: &EvaluationReport,
        discovery_query: &str,
    ) -> Result<()> {
        let json = serde_json::to_string(report).unwrap_or_default();
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT OR REPLACE INTO discovery_results
             (repo_full_name, evaluation_json, score, grade, track, discovery_query, discovered_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (
                &report.repo.full_name,
                &json,
                report.total_score,
                &report.grade,
                &report.track,
                discovery_query,
                &now,
            ),
        )?;
        Ok(())
    }

    pub fn get_discovery_results(&self, limit: usize) -> Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT evaluation_json, discovery_query, discovered_at
             FROM discovery_results
             ORDER BY discovered_at DESC
             LIMIT ?1",
        )?;
        let rows = stmt.query_map([limit as i64], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;

        let mut results = Vec::new();
        for row in rows {
            if let Ok((json, query, discovered_at)) = row {
                if let Ok(mut report) = serde_json::from_str::<serde_json::Value>(&json) {
                    if let Some(map) = report.as_object_mut() {
                        map.insert("discoveryQuery".to_string(), serde_json::Value::String(query));
                        map.insert("discoveredAt".to_string(), serde_json::Value::String(discovered_at));
                    }
                    results.push(report);
                }
            }
        }
        Ok(results)
    }

    pub fn clear_discovery_results(&self) -> Result<()> {
        self.conn.execute("DELETE FROM discovery_results", [])?;
        Ok(())
    }

    pub fn create_batch_session(&self, session_id: &str, query: &str, total: usize) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO batch_sessions (session_id, query, total_repos, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'running', ?4, ?4)",
            rusqlite::params![session_id, query, total, now],
        )?;
        Ok(())
    }

    pub fn update_batch_session(
        &self,
        session_id: &str,
        processed: usize,
        evaluated: usize,
        skipped: usize,
        status: &str,
    ) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE batch_sessions SET processed = ?1, evaluated = ?2, skipped = ?3, status = ?4, updated_at = ?5
             WHERE session_id = ?6",
            rusqlite::params![processed, evaluated, skipped, status, now, session_id],
        )?;
        Ok(())
    }

    pub fn mark_batch_repo_processed(&self, session_id: &str, repo_full_name: &str, status: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT OR REPLACE INTO batch_progress (session_id, repo_full_name, status, evaluated_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![session_id, repo_full_name, status, now],
        )?;
        Ok(())
    }

    pub fn get_processed_repos(&self, session_id: &str) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT repo_full_name FROM batch_progress WHERE session_id = ?1",
        )?;
        let rows = stmt.query_map([session_id], |row| row.get(0))?;
        let mut repos = Vec::new();
        for row in rows {
            repos.push(row?);
        }
        Ok(repos)
    }

    pub fn get_batch_session(&self, session_id: &str) -> Result<Option<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT session_id, query, total_repos, processed, evaluated, skipped, status, created_at, updated_at
             FROM batch_sessions WHERE session_id = ?1",
        )?;
        let mut rows = stmt.query_map([session_id], |row| {
            Ok(serde_json::json!({
                "sessionId": row.get::<_, String>(0)?,
                "query": row.get::<_, String>(1)?,
                "totalRepos": row.get::<_, usize>(2)?,
                "processed": row.get::<_, usize>(3)?,
                "evaluated": row.get::<_, usize>(4)?,
                "skipped": row.get::<_, usize>(5)?,
                "status": row.get::<_, String>(6)?,
                "createdAt": row.get::<_, String>(7)?,
                "updatedAt": row.get::<_, String>(8)?,
            }))
        })?;
        match rows.next() {
            Some(Ok(val)) => Ok(Some(val)),
            _ => Ok(None),
        }
    }

    pub fn get_incomplete_batch_sessions(&self) -> Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT session_id, query, total_repos, processed, evaluated, skipped, status, created_at, updated_at
             FROM batch_sessions WHERE status = 'running' OR status = 'paused'
             ORDER BY updated_at DESC LIMIT 10",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "sessionId": row.get::<_, String>(0)?,
                "query": row.get::<_, String>(1)?,
                "totalRepos": row.get::<_, usize>(2)?,
                "processed": row.get::<_, usize>(3)?,
                "evaluated": row.get::<_, usize>(4)?,
                "skipped": row.get::<_, usize>(5)?,
                "status": row.get::<_, String>(6)?,
                "createdAt": row.get::<_, String>(7)?,
                "updatedAt": row.get::<_, String>(8)?,
            }))
        })?;
        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(row?);
        }
        Ok(sessions)
    }

    pub fn delete_batch_session(&self, session_id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM batch_progress WHERE session_id = ?1", [session_id])?;
        self.conn.execute("DELETE FROM batch_sessions WHERE session_id = ?1", [session_id])?;
        Ok(())
    }

    pub fn get_stats(&self) -> Result<serde_json::Value> {
        let total: usize = self.conn
            .query_row("SELECT COUNT(*) FROM evaluation_history", [], |row| row.get(0))?;

        let by_grade: Vec<serde_json::Value> = {
            let mut stmt = self.conn.prepare(
                "SELECT grade, COUNT(*) as cnt FROM evaluation_history GROUP BY grade ORDER BY cnt DESC"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "grade": row.get::<_, String>(0)?,
                    "count": row.get::<_, usize>(1)?,
                }))
            })?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row?);
            }
            result
        };

        let by_track: Vec<serde_json::Value> = {
            let mut stmt = self.conn.prepare(
                "SELECT track, COUNT(*) as cnt FROM evaluation_history GROUP BY track ORDER BY cnt DESC"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "track": row.get::<_, String>(0)?,
                    "count": row.get::<_, usize>(1)?,
                }))
            })?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row?);
            }
            result
        };

        let avg_score: f64 = self.conn
            .query_row("SELECT COALESCE(AVG(score), 0.0) FROM evaluation_history", [], |row| row.get(0))?;

        let top_score: f64 = self.conn
            .query_row("SELECT COALESCE(MAX(score), 0.0) FROM evaluation_history", [], |row| row.get(0))?;

        let favorites: usize = self.conn
            .query_row("SELECT COUNT(*) FROM favorites", [], |row| row.get(0))?;

        let recent_7d: usize = self.conn
            .query_row(
                "SELECT COUNT(*) FROM evaluation_history WHERE evaluated_at >= datetime('now', '-7 days')",
                [],
                |row| row.get(0),
            )?;

        let score_distribution: Vec<serde_json::Value> = {
            let mut stmt = self.conn.prepare(
                "SELECT \
                    CASE \
                        WHEN score >= 90 THEN '90-105' \
                        WHEN score >= 80 THEN '80-89' \
                        WHEN score >= 73 THEN '73-79' \
                        WHEN score >= 60 THEN '60-72' \
                        ELSE '0-59' \
                    END AS bucket, \
                    COUNT(*) as cnt \
                FROM evaluation_history \
                GROUP BY bucket \
                ORDER BY MIN(score) DESC"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "bucket": row.get::<_, String>(0)?,
                    "count": row.get::<_, usize>(1)?,
                }))
            })?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row?);
            }
            result
        };

        let by_language: Vec<serde_json::Value> = {
            let mut stmt = self.conn.prepare(
                "SELECT \
                    json_extract(evaluation_json, '$.repo.language') AS lang, \
                    COUNT(*) as cnt \
                FROM evaluation_history \
                WHERE json_extract(evaluation_json, '$.repo.language') IS NOT NULL \
                GROUP BY lang \
                ORDER BY cnt DESC \
                LIMIT 10"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "language": row.get::<_, String>(0)?,
                    "count": row.get::<_, usize>(1)?,
                }))
            })?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row?);
            }
            result
        };

        let by_evidence: Vec<serde_json::Value> = {
            let mut stmt = self.conn.prepare(
                "SELECT \
                    json_extract(evaluation_json, '$.evidenceLevel') AS ev_level, \
                    COUNT(*) as cnt \
                FROM evaluation_history \
                WHERE json_extract(evaluation_json, '$.evidenceLevel') IS NOT NULL \
                GROUP BY ev_level \
                ORDER BY cnt DESC"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "evidenceLevel": row.get::<_, String>(0)?,
                    "count": row.get::<_, usize>(1)?,
                }))
            })?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row?);
            }
            result
        };

        Ok(serde_json::json!({
            "total": total,
            "byGrade": by_grade,
            "byTrack": by_track,
            "avgScore": (avg_score * 10.0).round() / 10.0,
            "topScore": (top_score * 10.0).round() / 10.0,
            "favorites": favorites,
            "recent7d": recent_7d,
            "scoreDistribution": score_distribution,
            "byLanguage": by_language,
            "byEvidence": by_evidence,
        }))
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
