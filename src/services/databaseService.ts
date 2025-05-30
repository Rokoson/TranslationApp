import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';


let _db: SQLiteDatabase | null = null;

async function getDatabase(): Promise<SQLiteDatabase> {
  if (!_db) {
    // console.log("[databaseService] getDatabase: Opening database...");
    _db = await openDatabaseAsync('pictureDictionary.db');
    // console.log("[databaseService] getDatabase: Database opened.");
  }
  return _db;
}

export interface DictionaryImage {
  id: number; // Database ID
  image_key: string; // e.g., 'cat', 'bird', used to map to require()
  asset_filename: string; // e.g., 'animals_cat.png'
  english_caption: string;
  category: string; // e.g., 'animals', 'body_parts'
  // yoruba_caption?: string; // Optional: to store translated captions later
}

// This data will be used to initially populate the database
const initialDictionaryData: Omit<DictionaryImage, 'id'>[] = [
  { image_key: 'cat', asset_filename: 'assets/images/animals_cat.png', english_caption: 'cat', category: 'animals' },
  { image_key: 'bird', asset_filename: 'assets/images/animals_bird.png', english_caption: 'bird', category: 'animals' },
  { image_key: 'dog', asset_filename: 'assets/images/animals_dog.png', english_caption: 'dog', category: 'animals' },
  { image_key: 'ears', asset_filename: 'assets/images/body_parts_ears.png', english_caption: 'ears', category: 'body_parts' },
  { image_key: 'hands', asset_filename: 'assets/images/body_parts_hands.png', english_caption: 'hands', category: 'body_parts' },
];

export const initDatabase = async (): Promise<void> => {
  const db = await getDatabase();
  // console.log("[databaseService] initDatabase: Initializing...");
  try {
    await db.withTransactionAsync( async () => {
      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS dictionary_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          image_key TEXT UNIQUE NOT NULL,
          asset_filename TEXT NOT NULL,
          english_caption TEXT NOT NULL,
          category TEXT
        );`,
        []
      );
      // console.log('[databaseService] initDatabase: Table dictionary_images ensured.');

      const countResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM dictionary_images;', []);

      if (countResult?.count === 0) {
        console.log('[databaseService] initDatabase: Database is empty, seeding initial data...');
        if (initialDictionaryData.length === 0) {
          console.log('[databaseService] initDatabase: No initial data to seed.');
          return;
        }
        for (const item of initialDictionaryData) {
          await db.runAsync(
            'INSERT INTO dictionary_images (image_key, asset_filename, english_caption, category) VALUES (?, ?, ?, ?);',
            [item.image_key, item.asset_filename, item.english_caption, item.category]
          );
          // console.log(`[databaseService] initDatabase: Seeded item with image_key: ${item.image_key}`);
        }
        console.log('[databaseService] initDatabase: Finished seeding initial data.');
      } else {
        // console.log(`[databaseService] initDatabase: Database already contains ${countResult?.count} items, skipping seed.`);
      }
    });
    // console.log('[databaseService] initDatabase: Initialization transaction completed.');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export const getDictionaryImages = async (limit: number, offset: number): Promise<DictionaryImage[]> => {
  const db = await getDatabase();
  try {
     const rows = await db.getAllAsync<DictionaryImage>(
        'SELECT * FROM dictionary_images ORDER BY category, english_caption LIMIT ? OFFSET ?',
        [limit, offset]
      );
    return rows || []; // Ensure an array is returned, even if rows is null/undefined
  } catch (error) {
    console.error('Error fetching dictionary images:', error);
    throw error;
  }
};

export const getTotalDictionaryImagesCount = async (): Promise<number> => {
  const db = await getDatabase();
  try {
    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM dictionary_images;', []);
    
    if (row && typeof row.count === 'number') {
      return row.count;
    }
    console.warn("[databaseService] getTotalDictionaryImagesCount: Could not retrieve a valid count. Returning 0.");
    return 0;
  } catch (error) {
    console.error('Error fetching total dictionary images count:', error);
    throw error;
  }
};
