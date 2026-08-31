import { useEffect, useRef } from "react";
import {
  clampTableSize,
  DEFAULT_TABLE_COLS,
  DEFAULT_TABLE_ROWS,
  stepTableSize,
} from "./table";

type ChooserField = "rows" | "cols";

interface TableSizeChooserProps {
  rows: number;
  cols: number;
  autoFocus?: boolean;
  onChange: (next: { rows: number; cols: number }) => void;
  onCommit: () => void;
}

export function TableSizeChooser({
  rows,
  cols,
  autoFocus = false,
  onChange,
  onCommit,
}: TableSizeChooserProps) {
  const rowsButtonRef = useRef<HTMLButtonElement>(null);
  const colsButtonRef = useRef<HTMLButtonElement>(null);
  const digitBufferRef = useRef("");
  const digitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    rowsButtonRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      if (digitTimerRef.current != null)
        window.clearTimeout(digitTimerRef.current);
    };
  }, []);

  const focusField = (field: ChooserField) => {
    const target =
      field === "rows" ? rowsButtonRef.current : colsButtonRef.current;
    target?.focus();
  };

  const applyValue = (field: ChooserField, value: number) => {
    if (field === "rows") {
      onChange({ rows: clampTableSize(value, rows), cols });
      return;
    }
    onChange({ rows, cols: clampTableSize(value, cols) });
  };

  const scheduleDigitReset = () => {
    if (digitTimerRef.current != null)
      window.clearTimeout(digitTimerRef.current);
    digitTimerRef.current = window.setTimeout(() => {
      digitBufferRef.current = "";
      digitTimerRef.current = null;
    }, 800);
  };

  const handleFieldKeyDown = (
    field: ChooserField,
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();

    if (event.key === "Tab") {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      onCommit();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusField("rows");
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusField("cols");
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? 1 : -1;
      const current = field === "rows" ? rows : cols;
      applyValue(field, stepTableSize(current, delta));
      return;
    }

    if (event.key.length === 1 && /[0-9]/.test(event.key)) {
      event.preventDefault();
      digitBufferRef.current = `${digitBufferRef.current}${event.key}`.slice(
        -2,
      );
      applyValue(
        field,
        Number(digitBufferRef.current) ||
          (field === "rows" ? DEFAULT_TABLE_ROWS : DEFAULT_TABLE_COLS),
      );
      scheduleDigitReset();
    }
  };

  const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const previewCells = Array.from({ length: rows * cols }, (_, index) => index);

  return (
    <div className="table-size-chooser" data-table-chooser="">
      <div className="calendar-block-controls">
        <div className="calendar-chooser-field">
          <button
            ref={rowsButtonRef}
            type="button"
            className="table-setup-count"
            aria-label="Rows"
            onMouseDown={stopPropagation}
            onClick={(event) => {
              event.preventDefault();
              focusField("rows");
            }}
            onKeyDown={(event) => handleFieldKeyDown("rows", event)}
          >
            {rows}
            <span className="table-setup-count-label"> rows</span>
          </button>
        </div>
        <div className="calendar-chooser-field">
          <button
            ref={colsButtonRef}
            type="button"
            className="table-setup-count"
            aria-label="Columns"
            onMouseDown={stopPropagation}
            onClick={(event) => {
              event.preventDefault();
              focusField("cols");
            }}
            onKeyDown={(event) => handleFieldKeyDown("cols", event)}
          >
            {cols}
            <span className="table-setup-count-label"> columns</span>
          </button>
        </div>
      </div>
      <p className="calendar-block-setup-hint">
        ↑↓ change · ←→ rows/columns · Enter insert
      </p>
      <div
        className="table-setup-preview"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {previewCells.map((index) => (
          <span key={index} className="table-setup-preview-cell" />
        ))}
      </div>
    </div>
  );
}
