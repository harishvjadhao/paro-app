from app.config import settings
from app.providers.prices.base import PriceProvider
from app.providers.prices.mock import MockPriceProvider
from app.providers.prices.yfinance_provider import YFinancePriceProvider


def get_price_provider() -> PriceProvider:
    if settings.price_provider.lower() == "mock":
        return MockPriceProvider()
    return YFinancePriceProvider()
