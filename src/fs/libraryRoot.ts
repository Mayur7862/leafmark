import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';

const APP_FOLDER = 'mreader';
const ORIGINALS_FOLDER = 'original_epubs';
const LIBRARY_JSON = 'library.json';

const ROOT_URI_KEY = 'mreader.libraryRootUri';
const ORIGINALS_URI_KEY = 'mreader.originalEpubsUri';
const LIBRARY_URI_KEY = 'mreader.libraryJsonUri';

export type LibraryFolders = {
  rootUri: string;
  originalsUri: string;
  libraryJsonUri: string;
  platform: 'ios' | 'android' | 'other';
};

function endsWithName(uri: string, name: string): boolean {
  const decoded = decodeURIComponent(uri).replace(/\/$/, '');
  return decoded.endsWith(`/${name}`) || decoded.endsWith(name);
}

async function findChildUri(parentUri: string, name: string): Promise<string | undefined> {
  const children = await LegacyFileSystem.StorageAccessFramework.readDirectoryAsync(parentUri);
  return children.find((uri) => endsWithName(uri, name));
}

function confirmAndroidFolderSetup(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Set up book folder',
      [
        'Original EPUBs are stored in a visible folder:',
        '',
        'Documents → mreader → original_epubs',
        '',
        'On the next screen:',
        '1. Open Documents (or Internal storage → Documents)',
        '2. Create a folder named mreader if it does not exist',
        '3. Tap that mreader folder',
        '4. Tap Use this folder / Allow',
        '',
        'You only need to do this once.',
      ].join('\n'),
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Choose folder',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false }
    );
  });
}

async function ensureIosFolders(): Promise<LibraryFolders> {
  const root = new Directory(Paths.document, APP_FOLDER);
  if (!root.exists) {
    root.create({ intermediates: true, idempotent: true });
  }

  const originals = new Directory(root, ORIGINALS_FOLDER);
  if (!originals.exists) {
    originals.create({ intermediates: true, idempotent: true });
  }

  const libraryJson = new File(root, LIBRARY_JSON);
  if (!libraryJson.exists) {
    libraryJson.create();
    libraryJson.write(JSON.stringify({ books: [] }));
  }

  return {
    rootUri: root.uri,
    originalsUri: originals.uri,
    libraryJsonUri: libraryJson.uri,
    platform: 'ios',
  };
}

async function ensureAndroidFolders(): Promise<LibraryFolders> {
  const { StorageAccessFramework } = LegacyFileSystem;

  const savedRoot = await AsyncStorage.getItem(ROOT_URI_KEY);
  const savedOriginals = await AsyncStorage.getItem(ORIGINALS_URI_KEY);
  const savedLibrary = await AsyncStorage.getItem(LIBRARY_URI_KEY);

  if (savedRoot && savedOriginals && savedLibrary) {
    return {
      rootUri: savedRoot,
      originalsUri: savedOriginals,
      libraryJsonUri: savedLibrary,
      platform: 'android',
    };
  }

  const shouldContinue = await confirmAndroidFolderSetup();
  if (!shouldContinue) {
    throw new Error('Folder setup cancelled. Choose the mreader folder to import books.');
  }

  const initial = StorageAccessFramework.getUriForDirectoryInRoot('Documents');
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync(initial);

  if (!permission.granted || !permission.directoryUri) {
    throw new Error(
      'No folder selected. Create Documents/mreader, select it, then tap Use this folder.'
    );
  }

  let rootUri = permission.directoryUri;
  const pickedIsMreader = endsWithName(rootUri, APP_FOLDER);

  if (!pickedIsMreader) {
    rootUri =
      (await findChildUri(rootUri, APP_FOLDER)) ??
      (await StorageAccessFramework.makeDirectoryAsync(rootUri, APP_FOLDER));
  }

  const originalsUri =
    (await findChildUri(rootUri, ORIGINALS_FOLDER)) ??
    (await StorageAccessFramework.makeDirectoryAsync(rootUri, ORIGINALS_FOLDER));

  let libraryJsonUri = await findChildUri(rootUri, LIBRARY_JSON);
  if (!libraryJsonUri) {
    libraryJsonUri = await StorageAccessFramework.createFileAsync(
      rootUri,
      'library',
      'application/json'
    );
    await LegacyFileSystem.writeAsStringAsync(libraryJsonUri, JSON.stringify({ books: [] }));
  }

  await AsyncStorage.setItem(ROOT_URI_KEY, rootUri);
  await AsyncStorage.setItem(ORIGINALS_URI_KEY, originalsUri);
  await AsyncStorage.setItem(LIBRARY_URI_KEY, libraryJsonUri);

  return {
    rootUri,
    originalsUri,
    libraryJsonUri,
    platform: 'android',
  };
}

/**
 * Visible layout:
 *   mreader/
 *     original_epubs/   ← original EPUB files
 *     library.json      ← library index
 */
export async function getSavedLibraryFolders(): Promise<LibraryFolders | null> {
  if (Platform.OS === 'android') {
    const savedRoot = await AsyncStorage.getItem(ROOT_URI_KEY);
    const savedOriginals = await AsyncStorage.getItem(ORIGINALS_URI_KEY);
    const savedLibrary = await AsyncStorage.getItem(LIBRARY_URI_KEY);
    if (!savedRoot || !savedOriginals || !savedLibrary) {
      return null;
    }
    return {
      rootUri: savedRoot,
      originalsUri: savedOriginals,
      libraryJsonUri: savedLibrary,
      platform: 'android',
    };
  }
  return ensureIosFolders();
}

export async function ensureLibraryFolders(): Promise<LibraryFolders> {
  if (Platform.OS === 'android') {
    return ensureAndroidFolders();
  }
  return ensureIosFolders();
}

export async function resetAndroidFolderPermission(): Promise<void> {
  await AsyncStorage.multiRemove([ROOT_URI_KEY, ORIGINALS_URI_KEY, LIBRARY_URI_KEY]);
}

export async function readTextUri(uri: string): Promise<string | null> {
  try {
    if (uri.startsWith('content://')) {
      return await LegacyFileSystem.readAsStringAsync(uri);
    }
    const file = new File(uri);
    if (!file.exists) {
      return null;
    }
    return await file.text();
  } catch {
    return null;
  }
}

export async function writeTextUri(uri: string, contents: string): Promise<void> {
  if (uri.startsWith('content://')) {
    await LegacyFileSystem.writeAsStringAsync(uri, contents);
    return;
  }
  const file = new File(uri);
  if (!file.exists) {
    file.create();
  }
  file.write(contents);
}

export async function copyEpubToOriginals(
  originalsUri: string,
  sourceUri: string,
  storageBaseName: string
): Promise<string> {
  if (originalsUri.startsWith('content://')) {
    const { StorageAccessFramework } = LegacyFileSystem;
    const target = await StorageAccessFramework.createFileAsync(
      originalsUri,
      storageBaseName,
      'application/epub+zip'
    );
    const base64 = await LegacyFileSystem.readAsStringAsync(sourceUri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    await LegacyFileSystem.writeAsStringAsync(target, base64, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    return target;
  }

  const target = new File(new Directory(originalsUri), `${storageBaseName}.epub`);
  if (target.exists) {
    target.delete();
  }
  new File(sourceUri).copy(target);
  return target.uri;
}

export async function deleteUriIfPossible(uri: string): Promise<void> {
  try {
    if (uri.startsWith('content://')) {
      await LegacyFileSystem.deleteAsync(uri, { idempotent: true });
      return;
    }
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // best-effort
  }
}

export async function readBytesFromUri(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('content://')) {
    const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    return base64ToBytes(base64);
  }
  return new File(uri).bytes();
}

function base64ToBytes(base64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/=+$/, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = alphabet.indexOf(clean[i]);
    const c2 = alphabet.indexOf(clean[i + 1]);
    const c3 = alphabet.indexOf(clean[i + 2] ?? 'A');
    const c4 = alphabet.indexOf(clean[i + 3] ?? 'A');
    const triple = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    bytes.push((triple >> 16) & 255);
    if (clean[i + 2]) {
      bytes.push((triple >> 8) & 255);
    }
    if (clean[i + 3]) {
      bytes.push(triple & 255);
    }
  }
  return Uint8Array.from(bytes);
}
