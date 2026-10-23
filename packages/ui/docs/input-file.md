# Input File

A file input with a drag-and-drop zone and click-to-browse. Each file is handed to `onFileAdded` as soon as it is chosen; the list shows a spinner while the promise is pending, a check mark when it resolves, and an error icon with a retry button when it rejects. Files that do not match `accept` are ignored.

## Import

```tsx
import { InputFile } from '@guillxume/ui/components/input-file'
```

## Props

| Prop            | Type                                              | Default | Description |
| --------------- | ------------------------------------------------- | ------- | ----------- |
| `onFileAdded`   | `(file: File) => Promise<unknown>`                | **required** | Called once per chosen file, typically to upload it. The resolved value is kept as the file's `serverData`. |
| `onFileRemoved` | `(file: File, serverData: unknown) => Promise<void>` | —   | Called when the user removes an uploaded file. The removal is optimistic: the file comes back in the list if the promise rejects. |
| `accept`        | `string`                                          | —       | File type filter (e.g. `.png,.jpg` or `image/*`) |
| `multiple`      | `boolean`                                         | `false` | Allow several files |
| `disabled`      | `boolean`                                         | `false` | Disable the input |
| `labels`        | `object`                                          | —       | Custom labels for i18n (see below) |

Also accepts standard `input` props (except `type`, `value`, `onChange`).

### Labels

| Key | Default | Description |
|-----|---------|-------------|
| `chooseFile` | `'Choose file to upload'` | Aria-label for the drop zone |
| `clickToUpload` | `'Click to upload'` | Visible text in the drop zone |
| `orDragAndDrop` | `'or drag and drop'` | Secondary text in the drop zone |
| `remove` | `'Remove'` | Prefix for the remove button aria-label (e.g. "Remove document.pdf") |
| `retry` | `'Retry'` | Aria-label of the retry button on a failed file |

## Examples

### Upload each file as it is chosen

```tsx
<InputFile
  accept='.pdf'
  onFileAdded={async file => {
    const body = new FormData()
    body.append('file', file)
    const res = await fetch('/api/files', { method: 'POST', body })
    if (!res.ok) throw new Error('Upload failed')
    return res.json() // kept as serverData
  }}
  onFileRemoved={async (_file, serverData) => {
    await fetch(`/api/files/${(serverData as { id: string }).id}`, {
      method: 'DELETE',
    })
  }}
/>
```

### Keep the files for a later submit

```tsx
const [files, setFiles] = useState<File[]>([])

<InputFile
  multiple
  accept='image/*'
  onFileAdded={async file => setFiles(prev => [...prev, file])}
  onFileRemoved={async file => setFiles(prev => prev.filter(f => f !== file))}
/>
```

### Disabled

```tsx
<InputFile disabled onFileAdded={async () => {}} />
```
