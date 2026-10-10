import numpy as np
import pandas as pd
import yfinance as yf
import joblib


def fetch_daily_history(ticker):
    raw = yf.download(
        tickers=ticker,
        period="6mo",
        interval="1d",
        auto_adjust=False,
        progress=False,
        multi_level_index=False,
    )

    if raw.empty:
        raise ValueError(
            f"No daily market data returned for '{ticker}'. "
            "Check that the ticker symbol is valid."
        )

    raw = raw.reset_index()

    if "Adj Close" not in raw.columns:
        raw["Adj Close"] = raw["Close"]

    required = ["Date", "Open", "High", "Low", "Close", "Adj Close", "Volume"]
    missing = [column for column in required if column not in raw.columns]

    if missing:
        raise ValueError(f"API data is missing required columns: {missing}")

    raw["Ticker"] = ticker

    return raw[
        ["Ticker", "Date", "Open", "High", "Low", "Close", "Adj Close", "Volume"]
    ].copy()


def build_features(db):
    db = db.copy()

    db["Date"] = pd.to_datetime(db["Date"])
    db = db.sort_values(["Ticker", "Date"]).reset_index(drop=True)

    group = db.groupby("Ticker", group_keys=False)

    db["prev_adj_close"] = group["Adj Close"].shift(1)

    db["return_1day"] = (db["Adj Close"] / db["prev_adj_close"]) - 1

    db["return_2day"] = (db["Adj Close"] / group["Adj Close"].shift(2)) - 1

    db["return_5day"] = (db["Adj Close"] / group["Adj Close"].shift(5)) - 1

    db["close_to_open_pct"] = ( db["Open"] / db["prev_adj_close"] ) - 1

    db["candle_stg"] = ( db["Close"] - db["Open"]) / db["Open"]

    db["range"] = (db["High"] - db["Low"]) / db["Open"]

    daily_range = db["High"] - db["Low"]

    db["close_pos"] = np.where( daily_range != 0, (db["Close"] - db["Low"]) / daily_range, 0.5,)

    db["sell_press_high"] = ( db["High"] - db[["Open", "Close"]].max(axis=1)) / db["Open"]

    db["lower_wick_pct"] = ( db[["Open", "Close"]].min(axis=1) - db["Low"]) / db["Open"]

    db["relative_price_short"] = (group["Adj Close"].transform(lambda prices: prices.rolling(window=5).mean()))

    db["relative_price_med"] = ( group["Adj Close"] .transform(lambda prices: prices.rolling(window=20).mean()))

    db["relative_price_short_ratio"] = ( db["Adj Close"] / db["relative_price_short"] )

    db["relative_price_med_ratio"] = ( db["Adj Close"] / db["relative_price_med"])

    db["volatility_5"] = (group["return_1day"].transform(lambda returns: returns.rolling(window=5).std()) )

    db["avg_volume_20"] = (group["Volume"].transform(lambda volume: volume.rolling(window=20).mean()))

    db["relative_volume_20"] = ( db["Volume"] / db["avg_volume_20"] )

    db["log_volume"] = np.log1p(db["Volume"])

    db["weekday"] = db["Date"].dt.dayofweek

    return db


def validate_latest_candle(row):
    low = row["Low"]
    high = row["High"]
    open_price = row["Open"]
    close_price = row["Close"]
    volume = row["Volume"]

    if low > high:
        raise ValueError("Invalid market data: Low is higher than High.")

    if not low <= open_price <= high:
        raise ValueError("Invalid market data: Open is outside the day's High-Low range.")

    if not low <= close_price <= high:
        raise ValueError("Invalid market data: Close is outside the day's High-Low range.")

    if volume <= 0:
        raise ValueError("Invalid market data: Volume must be positive.")


def make_prediction(ticker):
    artifact = joblib.load("model_weights.joblib")

    model = artifact["model"]
    feature_columns = artifact["feature_columns"]

    history = fetch_daily_history(ticker)
    featured_history = build_features(history)

    latest_row = featured_history.iloc[-1]

    validate_latest_candle(latest_row)

    missing_features = [
        column
        for column in feature_columns
        if column not in featured_history.columns
    ]

    if missing_features:
        raise ValueError(
            f"Feature-name mismatch. Model expects these missing columns: "
            f"{missing_features}"
        )

    x_live = featured_history.iloc[[-1]][feature_columns]

    if x_live.isna().any().any():
        missing = x_live.columns[x_live.isna().any()].tolist()

        raise ValueError(
            "Not enough valid historical data to compute: "
            + ", ".join(missing)
        )

    predicted_return = float(model.predict(x_live)[0])

    current_close = float(latest_row["Adj Close"])
    predicted_next_close = current_close * (1 + predicted_return)

    return {
        "ticker": ticker,
        "as_of_date": latest_row["Date"].date(),
        "open": float(latest_row["Open"]),
        "high": float(latest_row["High"]),
        "low": float(latest_row["Low"]),
        "close": float(latest_row["Close"]),
        "adj_close": current_close,
        "volume": int(latest_row["Volume"]),
        "predicted_return": predicted_return,
        "predicted_return_pct": predicted_return * 100,
        "predicted_next_close": predicted_next_close,
        "historical_test_mae_pct": artifact["model_mae"] * 100,
        "baseline_mae_pct": artifact["baseline_mae"] * 100,
    }


if __name__ == "__main__":
    ticker = input("Enter stock ticker, e.g. AAPL: ").strip().upper()

    try:
        result = make_prediction(ticker)

        print("\n--- Experimental end-of-day forecast ---")
        print(f"Ticker: {result['ticker']}")
        print(f"Latest completed daily bar: {result['as_of_date']}")
        print(f"Open: ${result['open']:.2f}")
        print(f"High: ${result['high']:.2f}")
        print(f"Low: ${result['low']:.2f}")
        print(f"Close: ${result['close']:.2f}")
        print(f"Volume: {result['volume']:,}")
        print()
        print(f"Predicted next-day return: {result['predicted_return_pct']:.3f}%")
        print(f"Estimated next-day close: ${result['predicted_next_close']:.2f}")
        print()
        print(
            "Historical holdout MAE: "
            f"{result['historical_test_mae_pct']:.3f} percentage points"
        )
        print(
            "Zero-return baseline MAE: "
            f"{result['baseline_mae_pct']:.3f} percentage points"
        )
        print(
            "\nWarning: this model did not outperform the zero-return "
            "baseline in your held-out test, so treat this as a demo forecast."
        )

    except Exception as error:
        print(f"\nPrediction failed: {error}")