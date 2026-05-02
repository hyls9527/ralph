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
