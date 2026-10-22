// Directory handles cannot be serialized to localStorage, but IndexedDB stores them natively.
const database_name = 'seraphim-editor'
const store_name = 'handles'
const recent_project_key = 'recent-project'

function to_promise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function open_database(): Promise<IDBDatabase> {
  const request = indexedDB.open(database_name, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(store_name)
  return to_promise(request)
}

export async function load_recent_project(): Promise<FileSystemDirectoryHandle | undefined> {
  const database = await open_database()
  try {
    const store = database.transaction(store_name, 'readonly').objectStore(store_name)
    return await to_promise<FileSystemDirectoryHandle | undefined>(store.get(recent_project_key))
  } finally {
    database.close()
  }
}

export async function save_recent_project(directory: FileSystemDirectoryHandle): Promise<void> {
  const database = await open_database()
  try {
    const store = database.transaction(store_name, 'readwrite').objectStore(store_name)
    await to_promise(store.put(directory, recent_project_key))
  } finally {
    database.close()
  }
}
