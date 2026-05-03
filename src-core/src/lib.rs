pub mod types;
pub mod github;
pub mod database;
pub mod evaluator;
pub mod discovery;
pub mod trend_analysis;
pub mod deep_analysis;

#[cfg(test)]
mod evaluator_tests;

#[cfg(test)]
mod github_tests;

#[cfg(test)]
mod integration_tests;

#[cfg(test)]
mod security_tests;
