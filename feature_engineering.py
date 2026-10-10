import pandas as pd
import numpy as np

db = pd.read_csv("SP500_Historical_Data.csv")

db["Date"] = pd.to_datetime(db["Date"])

#grouping data to each comapny using ticker then sorting it with dates
db.sort_values(by=["Ticker","Date"],inplace=True)

#grouping by ticker, and shifting to 1 as for row 0, adj close is missing
db["prev_adj_close"] = db.groupby("Ticker")["Adj Close"].shift(1)

#['Ticker', 'Date', 'Open', 'High', 'Low', 'Close', 'Adj Close','Volume'],

#previous day to day return
db["return_1day"] = (db["Adj Close"] / db["prev_adj_close"]) - 1

#previous day to 2 day return
db["return_2day"]  = (db["Adj Close"] /  db.groupby("Ticker")["Adj Close"].shift(2)) - 1

#return from day to previous 5 days
db["return_5day"] =  (db["Adj Close"] /  db.groupby("Ticker")["Adj Close"].shift(5)) - 1

#change % from previous day's close to today's open
db["close_to_open_pct"] = (db["Open"] /  db["prev_adj_close"]) - 1

#candle strength
db["candle_stg"] = (db["Close"] / db["Open"]) / db["Open"]

#highest to low range on open day
db["range"] = (db["High"] - db["Low"])/db["Open"]

#close position
db["close_pos"] = (db["Close"]-db["Low"]) / (db["High"] - db["Low"])

#selling pressure near high
db["sell_press_high"] = (db["High"] - db[["Open", "Close"]].max(axis=1)) / db["Open"]

#buying pressure near low
db["lower_wick_pct"] = (db[["Open", "Close"]].min(axis=1) - db["Low"]) / db["Open"]

#price relative to short trend
db["relative_price_short"] = (db.groupby("Ticker")["Adj Close"].transform(lambda prices: prices.rolling(window=5).mean())
)

#price relative to medium trend
db["relative_price_med"] = (db.groupby("Ticker")["Adj Close"].transform(lambda prices: prices.rolling(window=20).mean()))


# Price relative to its own moving averages
db["relative_price_short_ratio"] = db["Adj Close"] / db["relative_price_short"]

db["relative_price_med_ratio"] = db["Adj Close"] / db["relative_price_med"]


# Recent 5-trading-day volatility, based on your existing daily return feature
db["volatility_5"] = (db.groupby("Ticker")["return_1day"].transform(lambda returns: returns.rolling(window=5).std()))


# Average volume over the latest 20 trading days for each company
db["avg_volume_20"] = (
    db.groupby("Ticker")["Volume"]
      .transform(lambda volume: volume.rolling(window=20).mean())
)

# Today's volume compared to normal recent volume for that same company
db["relative_volume_20"] = db["Volume"] / db["avg_volume_20"]


# Compress huge volume values
db["log_volume"] = np.log1p(db["Volume"])


# Monday = 0, Tuesday = 1, ... Friday = 4
db["weekday"] = db["Date"].dt.dayofweek

#following trading day's adjusted close for each ticker
db["next_adj_close"] = (db.groupby("Ticker")["Adj Close"].shift(-1))
#we want the model to predict tomorrow's percentage move from today's adjusted close
db["target_return"] = (db["next_adj_close"] / db["Adj Close"]) - 1

cols_to_retain = ["Ticker","Date","Adj Close"]
feature_cols =  ["return_1day","return_2day","return_5day","close_to_open_pct","candle_stg","range", "close_pos",
    "sell_press_high","lower_wick_pct","relative_price_short_ratio","relative_price_med_ratio", "volatility_5","relative_volume_20",
    "log_volume","weekday",]


needed_columns = cols_to_retain+feature_cols + ["target_return"]

ml_db = db.dropna(subset=needed_columns).copy()

ml_db.to_csv("featured_db.csv", index=False)

print("Saved SP500_features.csv")

