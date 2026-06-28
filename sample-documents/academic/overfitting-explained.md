# Overfitting in Machine Learning

## What is overfitting?

Overfitting happens when a model learns the **training data too well** — including its
noise and random quirks — instead of the underlying pattern. The result is a model
that scores very high on the data it was trained on but performs poorly on new,
unseen data.

A simple analogy: imagine a student who memorizes the exact answers to last year's
exam questions instead of understanding the concepts. They ace the practice test but
fail the real exam, because the questions changed slightly. An overfit model is that
student.

## How to recognize it

The classic signal is a large gap between training and validation performance:

- **Training accuracy:** very high (e.g. 99%)
- **Validation / test accuracy:** much lower (e.g. 72%)

If your training error keeps dropping while your validation error starts rising, you
have crossed into overfitting.

## Why it happens

- The model is **too complex** for the amount of data (too many parameters/features).
- **Too little training data** relative to model capacity.
- **Training for too long**, so the model starts memorizing noise.
- **Data leakage** or irrelevant features the model latches onto.

## How to reduce overfitting

1. **Get more / better data** or use data augmentation.
2. **Simplify the model** — fewer layers, fewer features, lower polynomial degree.
3. **Regularization** — L1/L2 penalties, or dropout in neural networks.
4. **Early stopping** — stop training when validation error stops improving.
5. **Cross-validation** — use k-fold CV to get a more honest estimate of performance.
6. **Prune features** — remove redundant or noisy inputs.

## Overfitting vs. underfitting

- **Overfitting:** low bias, high variance — memorizes training data.
- **Underfitting:** high bias, low variance — too simple to capture the pattern.

The goal is the **bias–variance trade-off**: a model complex enough to learn the
signal, but not so complex that it learns the noise.
