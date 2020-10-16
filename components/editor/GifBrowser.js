//@flow
import * as React from "react";
import {
  Carousel,
  SearchBar,
  SearchContext,
  SearchContextManager,
  SuggestionBar,
} from "@giphy/react-components";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { useCallback, useState, useMemo, useContext } from "react";
import { Button, Col, Row } from "antd";
import { EditorContext } from "../data/EditorContext";

export default function GifBrowser(): React$Element<any> {
  const { onGifSelect } = useContext(EditorContext);
  const [isExpanded, setisExpanded] = useState(false);

  const toggleGifGrid = useCallback(() =>
    setisExpanded((isExpanded) => !isExpanded)
  );

  if (!isExpanded) {
    return (
      <Button block onClick={toggleGifGrid}>
        Add Gif
      </Button>
    );
  }

  return (
    <Col>
      <Row>
        <SearchContextManager apiKey={process.env.NEXT_PUBLIC_GIPHY_API_KEY}>
          <GifSelector onGifClick={onGifSelect} />
        </SearchContextManager>
      </Row>
      <Row>
        <Button block onClick={toggleGifGrid}>
          Close Gif
        </Button>
      </Row>
    </Col>
  );
}

type GifSelectorProps = {
  onGifClick: (Object) => void,
};

function GifSelector({ onGifClick }: GifSelectorProps) {
  const { fetchGifs, searchKey } = useContext(SearchContext);

  return (
    <Col>
      <SearchBar />
      <SuggestionBar />
      <Carousel
        key={searchKey}
        noLink
        hideAttribution
        gifHeight={220}
        fetchGifs={fetchGifs}
        onGifClick={onGifClick}
      />
    </Col>
  );
}
