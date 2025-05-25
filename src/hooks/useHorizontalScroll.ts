import { RefObject, useCallback, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';

interface UseHorizontalScrollProps {
  scrollRef: RefObject<ScrollView>;
}

export function useHorizontalScroll({ scrollRef }: UseHorizontalScrollProps) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const [currentScrollX, setCurrentScrollX] = useState(0);

  const updateScrollArrowVisibility = useCallback((offsetX: number, contentW: number, layoutW: number) => {
    if (layoutW <= 0) return;
    setCanScrollLeft(offsetX > 5); // Small threshold to prevent flickering
    setCanScrollRight(offsetX < contentW - layoutW - 5); // Small threshold
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setCurrentScrollX(contentOffset.x);
    updateScrollArrowVisibility(contentOffset.x, contentSize.width, layoutMeasurement.width);
  }, [updateScrollArrowVisibility]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const newWidth = event.nativeEvent.layout.width;
    setScrollViewWidth(newWidth);
    // updateScrollArrowVisibility might be called here if contentSize is known,
    // but onContentSizeChange is generally more reliable for initial setup.
  }, []);

  const handleContentSizeChange = useCallback((contentWidth: number) => {
    updateScrollArrowVisibility(currentScrollX, contentWidth, scrollViewWidth);
  }, [currentScrollX, scrollViewWidth, updateScrollArrowVisibility]);

  const scrollProgrammatically = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current || scrollViewWidth === 0) return;
    const scrollAmount = scrollViewWidth * 0.8; // Scroll 80% of visible width
    const newOffset = direction === 'left' ? Math.max(0, currentScrollX - scrollAmount) : currentScrollX + scrollAmount;
    scrollRef.current.scrollTo({ x: newOffset, animated: true });
  }, [scrollRef, currentScrollX, scrollViewWidth]);

  return {
    canScrollLeft,
    canScrollRight,
    handleScroll,
    handleLayout,
    handleContentSizeChange,
    scrollProgrammatically,
  };
}