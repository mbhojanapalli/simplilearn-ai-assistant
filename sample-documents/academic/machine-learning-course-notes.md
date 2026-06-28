# Machine Learning Foundations — Course Notes

These notes accompany the Simplilearn *Machine Learning Foundations* program and
summarize the key ideas covered in Modules 1–4.

## Module 1 — Types of learning

- **Supervised learning:** learn a mapping from inputs to labeled outputs.
  Examples: classification (spam vs. not spam) and regression (predicting price).
- **Unsupervised learning:** find structure in unlabeled data. Examples: clustering
  (k-means) and dimensionality reduction (PCA).
- **Reinforcement learning:** an agent learns by interacting with an environment and
  receiving rewards.

## Module 2 — The model-building workflow

1. Define the problem and success metric.
2. Collect and clean the data.
3. Split into **train / validation / test** sets (a common split is 70/15/15).
4. Engineer features and scale them.
5. Train a model and tune hyperparameters on the validation set.
6. Evaluate on the held-out test set — only once.

## Module 3 — Evaluation metrics

- **Classification:** accuracy, precision, recall, F1-score, ROC-AUC. Use precision/recall
  (not accuracy) when classes are imbalanced.
- **Regression:** Mean Absolute Error (MAE), Mean Squared Error (MSE), R².

> Tip: always compare your model against a simple **baseline** (e.g. predicting the
> majority class or the mean). If you can't beat the baseline, the model isn't learning.

## Module 4 — Generalization

A good model **generalizes** — it performs well on data it has never seen. The two
failure modes are **overfitting** (memorizing the training data) and **underfitting**
(too simple to capture the pattern). Techniques to improve generalization include
regularization, cross-validation, and gathering more representative data.

## Study guidance

- Re-implement at least one algorithm from scratch (e.g. linear regression) to build
  intuition before relying on libraries.
- For each metric, be able to explain *when* you would and would not use it.
- Practice on the weekly datasets provided in the course portal, and review the
  worked solutions after attempting them yourself.
