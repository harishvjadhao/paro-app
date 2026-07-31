from pydantic import BaseModel, Field


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class CommentOut(BaseModel):
    id: int
    symbol: str
    body: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class WatchToggleOut(BaseModel):
    symbol: str
    favorite: bool
    watchlist: bool


class ReorderIn(BaseModel):
    industry: str
    symbols: list[str]
