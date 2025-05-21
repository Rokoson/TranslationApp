import { useCallback, useRef, useState } from 'react';
import { ScrollView } from 'react-native';

export interface GalleryScrollHookResult {
  galleryScrollRef: React.RefObject<ScrollView>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  galleryScrollViewWidth: number;
  currentGalleryScrollX: number;
  handleGalleryScroll: (event: any) => void;
  handleGalleryLayout: (event: any) => void;
  handleGalleryContentSizeChange: (contentWidth: number, contentHeight: number) => void;
  scrollGallery: (direction: 'left' | 'right') => void;
}

export const useImageGalleryScroll = (): GalleryScrollHookResult => {
  const galleryScrollRef = useRef<ScrollView>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [galleryScrollViewWidth, setGalleryScrollViewWidth] = useState(0);
  const [currentGalleryScrollX, setCurrentGalleryScrollX] = useState(0);

  const updateScrollArrowVisibility = useCallback((
    contentOffsetX: number,
    contentWidth: number,
    layoutWidth: number
  ) => {
    if (layoutWidth <= 0) return;
    setCanScrollLeft(contentOffsetX > 5); // Small threshold
    setCanScrollRight(contentOffsetX < contentWidth - layoutWidth - 5); // Small threshold
  }, []);

  const handleGalleryScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setCurrentGalleryScrollX(contentOffset.x);
    updateScrollArrowVisibility(contentOffset.x, contentSize.width, layoutMeasurement.width);
  };
  
  const handleGalleryLayout = (event: any) => {
    const { width } = event.nativeEvent.layout;
    setGalleryScrollViewWidth(width);
    // Initial check for arrows might be needed here if content is already present
    // For now, onContentSizeChange and onScroll will primarily handle updates.
  };

  const handleGalleryContentSizeChange = (contentWidth: number, contentHeight: number) => {
    updateScrollArrowVisibility(currentGalleryScrollX, contentWidth, galleryScrollViewWidth);
  };

  const scrollGallery = (direction: 'left' | 'right') => {
    if (!galleryScrollRef.current) return;
    const scrollAmount = galleryScrollViewWidth * 0.8; // Scroll by 80% of visible width
    const currentOffset = currentGalleryScrollX;
    const newOffset = direction === 'left' 
      ? Math.max(0, currentOffset - scrollAmount) 
      : currentOffset + scrollAmount;
    galleryScrollRef.current.scrollTo({ x: newOffset, animated: true });
  };

  return {
    galleryScrollRef,
    canScrollLeft,
    canScrollRight,
    galleryScrollViewWidth,
    currentGalleryScrollX,
    handleGalleryScroll,
    handleGalleryLayout,
    handleGalleryContentSizeChange,
    scrollGallery,
  };
};