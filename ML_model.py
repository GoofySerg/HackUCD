import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error



db = pd.read_csv("featured_db.csv")
db["Date"] = pd.to_datetime(db["Date"])


feature_cols =  ["return_1day","return_2day","return_5day","close_to_open_pct","candle_stg","range", "close_pos",
    "sell_press_high","lower_wick_pct","relative_price_short_ratio","relative_price_med_ratio", "volatility_5","relative_volume_20",
    "log_volume","weekday",]

target_column = "target_return"


#Keeping only rows with complete features and target
db = db.dropna(subset=feature_cols+ [target_column]).copy()

#splitting data by date and in 80-20 proprotion
unique_dates = np.sort(db["Date"].unique())

cutoff_index = int(len(unique_dates) * 0.80)
cutoff_date = unique_dates[cutoff_index]

train_db = db[db["Date"] < cutoff_date].copy()
test_db = db[db["Date"] >= cutoff_date].copy()


X_train = train_db[feature_cols]
y_train = train_db[target_column]

X_test = test_db[feature_cols]
y_test = test_db[target_column]

baseline_predictions = np.zeros(len(y_test))

baseline_mae = mean_absolute_error(y_test, baseline_predictions)
baseline_rmse = mean_squared_error(y_test, baseline_predictions) ** 0.5

print("Training Random Forest...")

#non linear model
model = RandomForestRegressor(
    n_estimators=200,
    max_depth=12,
    min_samples_leaf=20,
    random_state=42,
    n_jobs=-1,
    verbose=2
)

model.fit(X_train, y_train)

model_predictions = model.predict(X_test)

model_mae = mean_absolute_error(y_test, model_predictions)
model_rmse = mean_squared_error(y_test, model_predictions) ** 0.5


print("\n--- Evaluation ---")
print(f"Baseline MAE: {baseline_mae:.6f} ({baseline_mae * 100:.3f} percentage points)")
print(f"Model MAE:    {model_mae:.6f} ({model_mae * 100:.3f} percentage points)")
print(f"Baseline RMSE: {baseline_rmse:.6f}")
print(f"Model RMSE:    {model_rmse:.6f}")


if model_mae < baseline_mae:
    print("\nResult: Model beat the zero-return baseline on this future test period.")
else:
    print("\nResult: Model did NOT beat the zero-return baseline.")
    print("Do not treat it as a useful forecasting model yet.")


# Display feature importance as a debugging clue
importance = pd.Series(
    model.feature_importances_,
    index=feature_cols
).sort_values(ascending=False)

print("\n--- Feature importance ---")
print(importance.to_string())


# Save only the objects needed later for API inference
model_artifact = {
    "model": model,
    "feature_columns": feature_cols,
    "target_column": target_column,
    "cutoff_date": str(pd.Timestamp(cutoff_date).date()),
    "baseline_mae": float(baseline_mae),
    "model_mae": float(model_mae),
}

joblib.dump(model_artifact, "stock_return_model.joblib")

print("\nSaved model: stock_return_model.joblib")


# Save a small sample for checking actual vs predicted returns
results = test_db[["Ticker", "Date", "Adj Close", target_column]].copy()
results["baseline_prediction"] = baseline_predictions
results["model_prediction"] = model_predictions

results.to_csv("test_predictions.csv", index=False)

print("Saved predictions: test_predictions.csv")