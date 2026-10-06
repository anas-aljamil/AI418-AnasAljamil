"""limit/offset pagination shared by every list endpoint."""

from typing import Annotated

from fastapi import Query
from pydantic import BaseModel


class PageParams(BaseModel):
    limit: int
    offset: int


def page_params(
    limit: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
    offset: Annotated[int, Query(ge=0, description="Items to skip")] = 0,
) -> PageParams:
    return PageParams(limit=limit, offset=offset)


class Page[T](BaseModel):
    items: list[T]
    total: int
    limit: int
    offset: int


def paginate[T](items: list[T], params: PageParams) -> Page[T]:
    return Page[T](
        items=items[params.offset : params.offset + params.limit],
        total=len(items),
        limit=params.limit,
        offset=params.offset,
    )
