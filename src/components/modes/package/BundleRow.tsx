import { AutoComplete, Input, Tooltip } from "antd";
import { CloseOutlined, FolderOutlined } from "@ant-design/icons";
import type { BundleItem } from "./PackageContext";
import { usePackage } from "./PackageContext";
import { typeBadge, typeKind } from "./fileType";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One editable file row in the bundler list: a type badge (so you can confirm
 * the tool knows what it is), an editable output name, an optional folder field
 * (empty = zip root), the size, and a remove button. This is the agnostic core
 * — every file is just a named, optionally-foldered entry.
 */
export function BundleRow({ item }: { item: BundleItem }) {
  const { updateItem, removeItem, folders } = usePackage();
  const kind = typeKind(item.name, item.type);
  const badge = typeBadge(item.name, item.type);

  // Suggest folders already in use so grouping is one click, not re-typing.
  const folderOptions = folders
    .filter((f) => f !== item.folder)
    .map((f) => ({ value: f }));

  return (
    <div className="fb-row">
      <span className="fb-row-badge" data-kind={kind} title={item.type || badge}>
        {badge}
      </span>

      <Input
        className="fb-row-name"
        value={item.name}
        onChange={(e) => updateItem(item.id, { name: e.target.value })}
        size="small"
        aria-label="File name in the zip"
      />

      <AutoComplete
        className="fb-row-folder"
        value={item.folder}
        options={folderOptions}
        onChange={(v) => updateItem(item.id, { folder: v })}
        filterOption={(input, option) =>
          (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
        }
        size="small"
      >
        <Input
          prefix={<FolderOutlined style={{ opacity: 0.5 }} />}
          placeholder="Folder (optional)"
          aria-label="Folder in the zip (optional)"
        />
      </AutoComplete>

      <span className="fb-row-size">{humanSize(item.size)}</span>

      <Tooltip title="Remove">
        <button
          type="button"
          className="fb-row-remove"
          aria-label={`Remove ${item.name}`}
          onClick={() => removeItem(item.id)}
        >
          <CloseOutlined />
        </button>
      </Tooltip>
    </div>
  );
}
