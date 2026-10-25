"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";

export type RoleTransferItem = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  permissions: string[];
};

type Side = "available" | "assigned";

type Props = {
  allRoles: RoleTransferItem[];
  assignedIds: string[];
  onAssignedIdsChange: (ids: string[]) => void;
};

function roleById(map: Map<string, RoleTransferItem>, id: string) {
  return map.get(id);
}

function DraggableRow({
  role,
  side,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
}: {
  role: RoleTransferItem;
  side: Side;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${side}:${role.id}`,
    data: { roleId: role.id, side },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border border-transparent",
        selected && "border-blue-200 bg-blue-50",
        isDragging && "shadow-md"
      )}
    >
      <div className="flex items-start gap-1 px-1 py-1">
        <button
          type="button"
          className="mt-1 p-1 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Drag ${role.name}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <input
          type="checkbox"
          className="mt-2 h-4 w-4 shrink-0"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${role.name}`}
        />
        <button
          type="button"
          className="flex-1 min-w-0 text-left px-1 py-1 rounded hover:bg-slate-100"
          onClick={onToggleExpand}
          onKeyDown={(e) => {
            if (e.key === " ") {
              e.preventDefault();
              onToggleSelect();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              onToggleExpand();
            }
          }}
        >
          <span className="flex items-center gap-1 text-sm font-medium text-slate-900">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <span className="truncate">{role.name}</span>
          </span>
          {expanded && (
            <p className="text-xs text-slate-500 mt-0.5 pl-5">
              {role.description || role.code}
              <span className="text-slate-400"> · {role.permissions.length} permissions</span>
            </p>
          )}
        </button>
      </div>
    </li>
  );
}

function RoleListPanel({
  title,
  side,
  roles,
  selectedIds,
  search,
  onSearchChange,
  onToggleSelect,
  onToggleSelectAll,
  onToggleExpand,
  expandedIds,
  dropId,
}: {
  title: string;
  side: Side;
  roles: RoleTransferItem[];
  selectedIds: Set<string>;
  search: string;
  onSearchChange: (v: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleExpand: (id: string) => void;
  expandedIds: Set<string>;
  dropId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  const allVisibleSelected = roles.length > 0 && roles.every((r) => selectedIds.has(r.id));

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border rounded-lg flex flex-col min-h-[240px] bg-white transition-colors",
        isOver && "ring-2 ring-blue-400 ring-offset-1"
      )}
    >
      <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={onToggleSelectAll}
            aria-label={`Select all visible in ${title}`}
          />
          All
        </label>
      </div>
      <input
        className="mx-2 mt-2 border rounded-md px-2 py-1.5 text-sm"
        placeholder="Search by role"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <ul className="flex-1 overflow-y-auto p-2 text-sm space-y-0.5 min-h-[160px]">
        {roles.length === 0 ? (
          <li className="text-xs text-slate-400 px-2 py-4 text-center">No roles</li>
        ) : (
          roles.map((r) => (
            <DraggableRow
              key={r.id}
              role={r}
              side={side}
              selected={selectedIds.has(r.id)}
              expanded={expandedIds.has(r.id)}
              onToggleSelect={() => onToggleSelect(r.id)}
              onToggleExpand={() => onToggleExpand(r.id)}
            />
          ))
        )}
      </ul>
    </div>
  );
}

export default function RoleTransferPanel({ allRoles, assignedIds, onAssignedIdsChange }: Props) {
  const [searchAvailable, setSearchAvailable] = useState("");
  const [searchAssigned, setSearchAssigned] = useState("");
  const [selectedAvailable, setSelectedAvailable] = useState<Set<string>>(new Set());
  const [selectedAssigned, setSelectedAssigned] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const roleMap = useMemo(() => new Map(allRoles.map((r) => [r.id, r])), [allRoles]);
  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);

  const availableRoles = useMemo(() => {
    const q = searchAvailable.trim().toLowerCase();
    return allRoles.filter(
      (r) =>
        !assignedSet.has(r.id) &&
        (!q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
    );
  }, [allRoles, assignedSet, searchAvailable]);

  const assignedRoles = useMemo(() => {
    const q = searchAssigned.trim().toLowerCase();
    return assignedIds
      .map((id) => roleMap.get(id))
      .filter(Boolean)
      .filter(
        (r) =>
          r &&
          (!q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
      ) as RoleTransferItem[];
  }, [assignedIds, roleMap, searchAssigned]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const moveToAssigned = useCallback(
    (ids: string[]) => {
      const toAdd = ids.filter((id) => !assignedSet.has(id));
      if (toAdd.length === 0) return;
      onAssignedIdsChange([...assignedIds, ...toAdd]);
      setSelectedAvailable((prev) => {
        const next = new Set(prev);
        toAdd.forEach((id) => next.delete(id));
        return next;
      });
    },
    [assignedIds, assignedSet, onAssignedIdsChange]
  );

  const moveToAvailable = useCallback(
    (ids: string[]) => {
      const remove = new Set(ids);
      if (remove.size === 0) return;
      onAssignedIdsChange(assignedIds.filter((id) => !remove.has(id)));
      setSelectedAssigned((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    },
    [assignedIds, onAssignedIdsChange]
  );

  function parseDragId(id: string): { side: Side; roleId: string } | null {
    const [side, ...rest] = id.split(":");
    if (side !== "available" && side !== "assigned") return null;
    const roleId = rest.join(":");
    if (!roleId) return null;
    return { side: side as Side, roleId };
  }

  function onDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const parsed = parseDragId(String(event.active.id));
    if (!parsed || !event.over) return;

    const overId = String(event.over.id);
    const { side, roleId } = parsed;

    const idsFromAvailable =
      side === "available" && selectedAvailable.has(roleId)
        ? Array.from(selectedAvailable)
        : [roleId];
    const idsFromAssigned =
      side === "assigned" && selectedAssigned.has(roleId) ? Array.from(selectedAssigned) : [roleId];

    if (overId === "drop-assigned" && side === "available") {
      moveToAssigned(idsFromAvailable);
    } else if (overId === "drop-available" && side === "assigned") {
      moveToAvailable(idsFromAssigned);
    }
  }

  const activeDragLabel = useMemo(() => {
    if (!activeDragId) return null;
    const parsed = parseDragId(activeDragId);
    if (!parsed) return null;
    return roleById(roleMap, parsed.roleId)?.name ?? null;
  }, [activeDragId, roleMap]);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
        <RoleListPanel
          title="Roles"
          side="available"
          roles={availableRoles}
          selectedIds={selectedAvailable}
          search={searchAvailable}
          onSearchChange={setSearchAvailable}
          onToggleSelect={(id) =>
            setSelectedAvailable((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onToggleSelectAll={() => {
            if (availableRoles.every((r) => selectedAvailable.has(r.id))) {
              setSelectedAvailable(new Set());
            } else {
              setSelectedAvailable(new Set(availableRoles.map((r) => r.id)));
            }
          }}
          onToggleExpand={(id) =>
            setExpandedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          expandedIds={expandedIds}
          dropId="drop-available"
        />

        <div className="flex flex-row lg:flex-col justify-center items-center gap-2 py-1 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => moveToAssigned(Array.from(selectedAvailable))}
            disabled={selectedAvailable.size === 0}
          >
            Add
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => moveToAssigned(allRoles.map((r) => r.id))}>
            Add all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => moveToAvailable(Array.from(selectedAssigned))}
            disabled={selectedAssigned.size === 0}
          >
            Remove
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onAssignedIdsChange([])}>
            Clear all
          </Button>
        </div>

        <RoleListPanel
          title="Assigned roles"
          side="assigned"
          roles={assignedRoles}
          selectedIds={selectedAssigned}
          search={searchAssigned}
          onSearchChange={setSearchAssigned}
          onToggleSelect={(id) =>
            setSelectedAssigned((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onToggleSelectAll={() => {
            if (assignedRoles.every((r) => selectedAssigned.has(r.id))) {
              setSelectedAssigned(new Set());
            } else {
              setSelectedAssigned(new Set(assignedRoles.map((r) => r.id)));
            }
          }}
          onToggleExpand={(id) =>
            setExpandedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          expandedIds={expandedIds}
          dropId="drop-assigned"
        />
      </div>

      <DragOverlay>
        {activeDragLabel ? (
          <div className="rounded-md bg-white border shadow-lg px-3 py-2 text-sm font-medium">{activeDragLabel}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
