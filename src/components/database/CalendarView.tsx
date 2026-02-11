import { useEffect, useMemo, useState } from "react";
import { useDatabaseStore } from "@/stores/useDatabaseStore";
import { useLocaleStore } from "@/stores/useLocaleStore";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { DatabaseIconButton, DatabasePanel } from "./primitives";
import {
  addMonths,
  buildMonthGrid,
  resolveCalendarDateColumnId,
  splitRowsByCalendarDate,
  toDateKey,
} from "./calendarUtils";

interface CalendarViewProps {
  dbId: string;
}

export function CalendarView({ dbId }: CalendarViewProps) {
  const { t, locale } = useLocaleStore();
  const { databases, getFilteredSortedRows, updateView } = useDatabaseStore();
  const db = databases[dbId];
  const rows = useMemo(() => getFilteredSortedRows(dbId), [dbId, getFilteredSortedRows, db?.rows, db?.views]);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  if (!db) return null;

  const activeView = db.views.find((view) => view.id === db.activeViewId);
  if (!activeView) return null;

  const dateColumns = db.columns.filter((column) => column.type === "date");
  const resolvedDateColumnId = resolveCalendarDateColumnId(db.columns, activeView.dateColumn);

  useEffect(() => {
    if (activeView.type !== "calendar") return;
    if (!resolvedDateColumnId) return;
    if (activeView.dateColumn === resolvedDateColumnId) return;
    updateView(dbId, activeView.id, { dateColumn: resolvedDateColumnId });
  }, [activeView.dateColumn, activeView.id, activeView.type, dbId, resolvedDateColumnId, updateView]);

  const monthGrid = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(currentMonth),
    [currentMonth, locale],
  );
  const weekdayLabels = useMemo(() => {
    const base = new Date(Date.UTC(2026, 0, 4)); // Sunday
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(base.getTime() + index * 86400000)));
  }, [locale]);

  const dateGroups = useMemo(
    () =>
      resolvedDateColumnId
        ? splitRowsByCalendarDate(rows, resolvedDateColumnId)
        : { grouped: {}, undated: rows },
    [resolvedDateColumnId, rows],
  );
  const todayKey = toDateKey(new Date());
  const emptyDateStrategy = activeView.calendarEmptyDateStrategy ?? "show";

  if (dateColumns.length === 0) {
    return (
      <div className="h-full p-6">
        <div className="db-empty-state h-full flex flex-col items-center justify-center gap-2">
          <CalendarDays className="w-5 h-5 text-muted-foreground" />
          <p>{t.database.calendar.noDateColumnTitle}</p>
          <p className="text-xs text-muted-foreground">{t.database.calendar.noDateColumnDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <DatabasePanel className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <DatabaseIconButton
              onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
              aria-label={t.database.calendar.prevMonth}
              title={t.database.calendar.prevMonth}
            >
              <ChevronLeft className="w-4 h-4" />
            </DatabaseIconButton>
            <button
              className="db-toggle-btn h-8 px-3"
              onClick={() => setCurrentMonth(new Date())}
            >
              {t.database.calendar.today}
            </button>
            <DatabaseIconButton
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
              aria-label={t.database.calendar.nextMonth}
              title={t.database.calendar.nextMonth}
            >
              <ChevronRight className="w-4 h-4" />
            </DatabaseIconButton>
          </div>
          <p className="text-sm font-semibold">{monthLabel}</p>
        </div>
      </DatabasePanel>

      <div className="mt-3 grid grid-cols-7 gap-2" role="grid" aria-label={monthLabel}>
        {weekdayLabels.map((label) => (
          <div key={label} className="px-2 text-xs text-muted-foreground">
            {label}
          </div>
        ))}
        {monthGrid.map((day) => {
          const dayRows = dateGroups.grouped[day.key] || [];
          return (
            <DatabasePanel
              key={day.key}
              className={`min-h-[120px] p-2 ${
                day.key === todayKey ? "ring-1 ring-primary/55 bg-primary/[0.06]" : ""
              } ${!day.inCurrentMonth ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{day.date.getDate()}</span>
                {dayRows.length > 0 && <span className="db-count-badge">{dayRows.length}</span>}
              </div>
              <div className="mt-1.5 space-y-1">
                {dayRows.slice(0, 3).map((row) => (
                  <div key={row.id} className="rounded-ui-sm border border-border/60 bg-background/45 px-1.5 py-1">
                    <p className="text-xs truncate">{row.noteTitle}</p>
                  </div>
                ))}
                {dayRows.length > 3 && (
                  <p className="text-[11px] text-muted-foreground">+{dayRows.length - 3} {t.database.calendar.more}</p>
                )}
              </div>
            </DatabasePanel>
          );
        })}
      </div>

      {emptyDateStrategy === "show" && dateGroups.undated.length > 0 && (
        <DatabasePanel className="mt-3 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t.database.calendar.noDateBucket}</p>
            <span className="db-count-badge">{dateGroups.undated.length}</span>
          </div>
          <div className="mt-2 grid gap-1">
            {dateGroups.undated.slice(0, 8).map((row) => (
              <div key={row.id} className="rounded-ui-sm border border-border/60 bg-background/45 px-2 py-1.5 text-sm truncate">
                {row.noteTitle}
              </div>
            ))}
            {dateGroups.undated.length > 8 && (
              <p className="text-xs text-muted-foreground">
                +{dateGroups.undated.length - 8} {t.database.calendar.more}
              </p>
            )}
          </div>
        </DatabasePanel>
      )}
    </div>
  );
}
