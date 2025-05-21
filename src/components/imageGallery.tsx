import { DisplayableImageItem } from '@/app/imageCaption'; // Assuming DisplayableImageItem is exported from imageCaption.tsx or moved to a shared types file
import { useImageGalleryScroll } from '@/src/hooks/useImageGalleryScroll';
import React from 'react';
import { Button, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ImageGalleryProps {
  items: DisplayableImageItem[];
  onSelectItem: (item: DisplayableImageItem) => void;
  currentApiIdentifier: string | null;
  canInteractWithGallery: boolean;
  allImageSources?: Record<string, number>; // Optional, only for local gallery
  galleryTitle: string;
  isLoadingMore?: boolean; // For "Load More" button
  canLoadMore?: boolean;   // For "Load More" button
  onLoadMore?: () => void; // For "Load More" button
  testID?: string; // For testing
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  items,
  onSelectItem,
  currentApiIdentifier,
  canInteractWithGallery,
  allImageSources,
  galleryTitle,
  isLoadingMore,
  canLoadMore,
  onLoadMore,
  testID
}) => {
  const {
    galleryScrollRef,
    canScrollLeft,
    canScrollRight,
    handleGalleryScroll,
    handleGalleryLayout,
    handleGalleryContentSizeChange,
    scrollGallery,
  } = useImageGalleryScroll();

  if (!items || items.length === 0) {
    // Optionally render a placeholder or nothing if no items
    // For example, if it's the server gallery and no items are fetched yet,
    // we might not want to show "No images in server images gallery." until after a fetch attempt.
    // For now, returning null if items array is empty.
    return null;
  }

  return (
    <>
      <Text style={styles.galleryTitleStyle}>{galleryTitle}</Text>
      <View style={styles.galleryContainerWithArrowsStyle} testID={testID}>
        {canScrollLeft && (
          <Pressable onPress={() => scrollGallery('left')} style={[styles.arrowButtonStyle, styles.leftArrowStyle]}>
            <Text style={styles.arrowTextStyle}>{"<"}</Text>
          </Pressable>
        )}
        <ScrollView
          ref={galleryScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.galleryScrollViewStyle}
          onScroll={handleGalleryScroll}
          onLayout={handleGalleryLayout}
          onContentSizeChange={handleGalleryContentSizeChange}
          scrollEventThrottle={16}
        >
          {items.map((item) => (
            <Pressable
              key={item.image_key}
              onPress={() => onSelectItem(item)}
              style={[
                styles.galleryItemStyle,
                currentApiIdentifier === item.image_key && styles.galleryItemSelectedStyle,
                !canInteractWithGallery && styles.galleryItemDisabledStyle,
              ]}
              disabled={!canInteractWithGallery}
            >
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.galleryImageStyle}
                  resizeMode="cover"
                  onLoad={() => console.log(`[ImageGallery] Image LOADED: ${item.image_key} from ${item.image_url}`)}
                  onError={(e) => console.error(`[ImageGallery] Image FAILED to load: ${item.image_key} from ${item.image_url}. Error: ${e.nativeEvent.error}`)}
                />
              ) : allImageSources && allImageSources[item.image_key] ? (
                <Image
                  source={allImageSources[item.image_key]}
                  style={styles.galleryImageStyle}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.galleryImageStyle, styles.galleryImagePlaceholderStyle]}>
                  <Text style={styles.galleryImagePlaceholderTextStyle}>?</Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
        {canScrollRight && (
          <Pressable onPress={() => scrollGallery('right')} style={[styles.arrowButtonStyle, styles.rightArrowStyle]}>
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