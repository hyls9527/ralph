use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BadgeInfo {
    pub grade: String,
    pub score: f64,
    pub color: String,
    pub url: String,
    pub markdown: String,
    pub html: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BadgeGrade {
    S,
    A,
    B,
    C,
    X,
}

impl BadgeGrade {
    pub fn from_str(grade: &str) -> Self {
        match grade {
            "S" => BadgeGrade::S,
            "A" => BadgeGrade::A,
            "B" => BadgeGrade::B,
            "C" => BadgeGrade::C,
            _ => BadgeGrade::X,
        }
    }

    pub fn color(&self) -> &'static str {
        match self {
            BadgeGrade::S => "FFD700",
            BadgeGrade::A => "22C55E",
            BadgeGrade::B => "3B82F6",
            BadgeGrade::C => "9CA3AF",
            BadgeGrade::X => "EF4444",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            BadgeGrade::S => "S",
            BadgeGrade::A => "A",
            BadgeGrade::B => "B",
            BadgeGrade::C => "C",
            BadgeGrade::X => "X",
        }
    }
}

pub fn generate_badge_url(grade: &str, score: f64) -> String {
    let badge_grade = BadgeGrade::from_str(grade);
    let color = badge_grade.color();
    let score_display = format!("{:.0}", score);
    format!(
        "https://img.shields.io/badge/Ralph-{}-{}-{}",
        badge_grade.label(),
        score_display,
        color
    )
}

pub fn generate_badge(grade: String, score: f64, repo_full_name: String) -> BadgeInfo {
    let badge_grade = BadgeGrade::from_str(&grade);
    let color = badge_grade.color().to_string();
    let url = generate_badge_url(&grade, score);
    let score_display = format!("{:.0}", score);

    let markdown = format!(
        "[![Ralph {} {}]({})](https://github.com/{})",
        grade, score_display, url, repo_full_name
    );

    let html = format!(
        r#"<a href="https://github.com/{}"><img src="{}" alt="Ralph {} {}" /></a>"#,
        repo_full_name, url, grade, score_display
    );

    BadgeInfo {
        grade,
        score,
        color,
        url,
        markdown,
        html,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_badge_grade_from_str_s() {
        assert_eq!(BadgeGrade::from_str("S"), BadgeGrade::S);
    }

    #[test]
    fn test_badge_grade_from_str_a() {
        assert_eq!(BadgeGrade::from_str("A"), BadgeGrade::A);
    }

    #[test]
    fn test_badge_grade_from_str_b() {
        assert_eq!(BadgeGrade::from_str("B"), BadgeGrade::B);
    }

    #[test]
    fn test_badge_grade_from_str_c() {
        assert_eq!(BadgeGrade::from_str("C"), BadgeGrade::C);
    }

    #[test]
    fn test_badge_grade_from_str_unknown() {
        assert_eq!(BadgeGrade::from_str("Z"), BadgeGrade::X);
    }

    #[test]
    fn test_badge_grade_from_str_lowercase() {
        assert_eq!(BadgeGrade::from_str("a"), BadgeGrade::X);
    }

    #[test]
    fn test_badge_grade_colors() {
        assert_eq!(BadgeGrade::S.color(), "FFD700");
        assert_eq!(BadgeGrade::A.color(), "22C55E");
        assert_eq!(BadgeGrade::B.color(), "3B82F6");
        assert_eq!(BadgeGrade::C.color(), "9CA3AF");
        assert_eq!(BadgeGrade::X.color(), "EF4444");
    }

    #[test]
    fn test_badge_grade_labels() {
        assert_eq!(BadgeGrade::S.label(), "S");
        assert_eq!(BadgeGrade::A.label(), "A");
        assert_eq!(BadgeGrade::B.label(), "B");
        assert_eq!(BadgeGrade::C.label(), "C");
        assert_eq!(BadgeGrade::X.label(), "X");
    }

    #[test]
    fn test_generate_badge_url_s_grade() {
        let url = generate_badge_url("S", 95.0);
        assert!(url.contains("Ralph-S-95-FFD700"));
        assert!(url.starts_with("https://img.shields.io/badge/"));
    }

    #[test]
    fn test_generate_badge_url_a_grade() {
        let url = generate_badge_url("A", 82.0);
        assert!(url.contains("Ralph-A-82-22C55E"));
    }

    #[test]
    fn test_generate_badge_url_b_grade() {
        let url = generate_badge_url("B", 73.0);
        assert!(url.contains("Ralph-B-73-3B82F6"));
    }

    #[test]
    fn test_generate_badge_url_unknown_grade() {
        let url = generate_badge_url("Z", 50.0);
        assert!(url.contains("Ralph-X-50-EF4444"));
    }

    #[test]
    fn test_generate_badge_url_score_rounding() {
        let url = generate_badge_url("A", 82.7);
        assert!(url.contains("Ralph-A-83-22C55E"));
    }

    #[test]
    fn test_generate_badge_full() {
        let badge = generate_badge("A".to_string(), 85.0, "test/repo".to_string());
        assert_eq!(badge.grade, "A");
        assert_eq!(badge.score, 85.0);
        assert_eq!(badge.color, "22C55E");
        assert!(badge.url.contains("Ralph-A-85-22C55E"));
        assert!(badge.markdown.contains("[![Ralph A 85]"));
        assert!(badge.markdown.contains("](https://github.com/test/repo)"));
        assert!(badge.html.contains("https://github.com/test/repo"));
        assert!(badge.html.contains("Ralph A 85"));
    }

    #[test]
    fn test_generate_badge_s_grade_full() {
        let badge = generate_badge("S".to_string(), 100.0, "awesome/project".to_string());
        assert_eq!(badge.grade, "S");
        assert_eq!(badge.color, "FFD700");
        assert!(badge.markdown.contains("Ralph S 100"));
    }

    #[test]
    fn test_generate_badge_x_grade_full() {
        let badge = generate_badge("X".to_string(), 30.0, "bad/repo".to_string());
        assert_eq!(badge.grade, "X");
        assert_eq!(badge.color, "EF4444");
        assert!(badge.markdown.contains("Ralph X 30"));
    }
}
