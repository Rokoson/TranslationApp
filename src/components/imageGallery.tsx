import { DisplayableImageItem } from '@/app/imageCaption'; // Assuming DisplayableImageItem is exported from imageCaption.tsx or moved to a shared types file
import React, { RefObject } from 'react';
import {
  Button,
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

interface ImageGalleryProps {
  title: string; // Renamed from galleryTitle for consistency, or keep as galleryTitle if preferred
  items: DisplayableImageItem[];
  onSelectItem: (item: DisplayableImageItem) => void;
  currentSelectedItemKey: string | null; // Renamed from currentApiIdentifier
  canInteractWithGallery: boolean;
  isLoadingMore?: boolean; // For "Load More" button
  canLoadMore?: boolean;   // For "Load More" button
  onLoadMore?: () => void; // For "Load More" button
  testID?: string; // For testing

  // Props from useHorizontalScroll (passed by parent)
  scrollRef: RefObject<ScrollView>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  onScrollArrowPress: (direction: 'left' | 'right') => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleLayout: (event: LayoutChangeEvent) => void;
  handleContentSizeChange: (width: number, height: number) => void;
  resolveItemSource: (item: DisplayableImageItem) => ImageSourcePropType | undefined;
  isThisGalleryActive: boolean; // To correctly apply selection style
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  title,
  items,
  onSelectItem,
  currentSelectedItemKey,
  canInteractWithGallery,
  isLoadingMore,
  canLoadMore,
  onLoadMore,
  testID,
  scrollRef,
  canScrollLeft,
  canScrollRight,
  onScrollArrowPress,
  handleScroll,
  handleLayout,
  handleContentSizeChange,
  resolveItemSource,
  isThisGalleryActive,
}) => {
  if (!items || items.length === 0) {
    // Optionally render a placeholder or nothing if no items
    // For example, if it's the server gallery and no items are fetched yet,
    // we might not want to show "No images in server images gallery." until after a fetch attempt.
    // For now, returning null if items array is empty.
    return null;
  }

  return (
    <>
      <Text style={styles.galleryTitleStyle}>{title}</Text>
      <View style={styles.galleryContainerWithArrowsStyle} testID={testID}>
        {canScrollLeft && (
          <Pressable onPress={() => onScrollArrowPress('left')} style={[styles.arrowButtonStyle, styles.leftArrowStyle]}>
            <Text style={styles.arrowTextStyle}>{"<"}</Text>
          </Pressable>
        )}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.galleryScrollViewStyle}
          onScroll={handleScroll}
          onLayout={handleLayout}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
        >
          {items.map((item) => {
            const imageSource = resolveItemSource(item);
            return (
              <Pressable
                key={item.image_key} // Assuming image_key is unique and present
                onPress={() => onSelectItem(item)}
                style={[
                  styles.galleryItemStyle,
                  isThisGalleryActive && currentSelectedItemKey === item.image_key && styles.galleryItemSelectedStyle,
                  !canInteractWithGallery && styles.galleryItemDisabledStyle,
                ]}
                disabled={!canInteractWithGallery}
              >
                {imageSource ? (
                  <Image source={imageSource} style={styles.galleryImageStyle} resizeMode="cover" />
                ) : (
                  <View style={[styles.galleryImageStyle, styles.galleryImagePlaceholderStyle]}>
                    <Text style={styles.galleryImagePlaceholderTextStyle}>?</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        {canScrollRight && (
          <Pressable onPress={() => onScrollArrowPress('right')} style={[styles.arrowButtonStyle, styles.rightArrowStyle]}>
            <Text style={styles.arrowTextStyle}>{">"}</Text>
          </Pressable>
        )}
      </View>
      {onLoadMore && canLoadMore && (
         <View style={styles.loadMoreButtonContainerStyle}>
            <Button 
                title={isLoadingMore ? "Loading..." : "Load More"}
                onPress={onLoadMore} 
                disabled={isLoadingMore || !canInteractWithGallery}
            />
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  galleryTitleStyle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  galleryContainerWithArrowsStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10, // Added margin below the gallery scroll area
  },
  galleryScrollViewStyle: {
    flex: 1,
    maxHeight: 120, // Consistent with original
  },
  galleryItemStyle: {
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd', // Softer border
    borderRadius: 8,    // Rounded corners
    overflow: 'hidden', // Ensures image respects border radius
  },
  galleryItemSelectedStyle: {
    borderColor: '#007AFF', // Blue border for selected
    borderWidth: 2,
  },
  galleryItemDisabledStyle: {
    opacity: 0.5,
  },
  galleryImageStyle: {
    width: 80, // Consistent with original
    height: 80, // Consistent with original
  },
  galleryImagePlaceholderStyle: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImagePlaceholderTextStyle: {
    fontSize: 24,
    color: '#a0a0a0',
  },
  arrowButtonStyle: {
    paddingHorizontal: 8,
    paddingVertical: 20, // Make it easier to tap
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  leftArrowStyle: {
    // marginRight: 5, // Optional space
  },
  rightArrowStyle: {
    // marginLeft: 5, // Optional space
  },
  arrowTextStyle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF', // Blue arrows
  },
  loadMoreButtonContainerStyle: {
    alignItems: 'center',
    marginVertical: 5, // Reduced margin a bit
  },
});