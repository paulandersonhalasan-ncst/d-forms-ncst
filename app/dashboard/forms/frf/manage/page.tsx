// app/dashboard/forms/frf/manage/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Card,
  Title,
  Table,
  Button,
  Group,
  TextInput,
  Modal,
  Stack,
  Text,
  Badge,
  Tabs,
  NumberInput,
  Select,
  Checkbox,
  ScrollArea,
  LoadingOverlay,
  SimpleGrid,
  Alert,
  Collapse,
  ActionIcon,
  MultiSelect,
  Paper
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconBuilding, IconBox, IconArrowLeft, IconSettings, IconInfoCircle, IconChevronDown, } from '@tabler/icons-react';
import useSWR from 'swr';

// === Types ===
type SystemBranch = 'MAIN' | 'IMUS' | 'NASTECH' | 'SHS';

interface Place {
  id: string;
  name: string;
  isActive: boolean;
  branch: SystemBranch;
  category?: 'REGULAR' | 'CATEGORY_1' | 'CATEGORY_2';
}

interface EquipmentPlace {
  placeId: string;
  isBundled: boolean; 
  place?: { id: string; name: string; branch: SystemBranch };
}

interface EquipmentItem {
  id: string;
  name: string;
  departmentCode: string;
  isSingleItem: boolean;
  quantityAvailable: number;
  quantityReserved?: number;
  branch?: SystemBranch | null;
  places?: EquipmentPlace[];
  useCount?: number;
  totalDeployedQty?: number;
}

interface User {
  id: string;
  employee_id: string;
  email: string;
  fname: string;
  lname: string;
  role: string;
  departmentCode: string;
  branch: string;
  oic_start: string | null;
  oic_end: string | null;
}

interface TabProps {
  currentUser?: User | null;
}

// SWR fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

function CollapsibleAlert({
  title,
  icon,
  color = 'blue',
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: React.ReactNode;
  color?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [opened, setOpened] = useState(defaultOpen);

  return (
    <Alert
      color={color}
      radius="md"
      mb="md"
      p="sm"
      autoContrast
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => setOpened((o) => !o)}
      styles={(theme) => ({
        root: { border: `1px solid ${theme.colors[color]?.[3] ?? theme.colors.blue[3]}` },
        title: { width: '100%' },
        body: { width: '100%' },
      })}
      title={
        <Group justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
          <Group gap="xs" wrap="nowrap">
            {icon}
            <Text fw={500} size="sm">{title}</Text>
          </Group>
          <ActionIcon variant="subtle" color={color}>
            <IconChevronDown
              size={16}
              style={{
                transform: opened ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
              }}
            />
          </ActionIcon>
        </Group>
      }
    >
      <Collapse expanded={opened}>
        <Text size="xs" mt="xs" lh={1.6}>
          {children}
        </Text>
      </Collapse>
    </Alert>
  );
}

  type SortDirection = 'asc' | 'desc';

  function SortableTh({
    label,
    column,
    sortColumn,
    sortDirection,
    onSort,
    width,
  }: {
    label: string;
    column: string;
    sortColumn: string | null;
    sortDirection: SortDirection;
    onSort: (col: string) => void;
    width?: number | string;
  }) {
    const isActive = sortColumn === column;
    return (
      <Table.Th
        style={{ width, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => onSort(column)}
      >
        <Group gap={4} wrap="nowrap">
          <Text size="sm" fw={600}>{label}</Text>
          <IconChevronDown
            size={14}
            style={{
              opacity: isActive ? 1 : 0.3,
              transform: isActive && sortDirection === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
            }}
          />
        </Group>
      </Table.Th>
    );
  }

// === Places Management Component ===
function PlacesTab({ currentUser }: TabProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Place | null>(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState<Place['category']>('REGULAR');
  const [branch, setBranch] = useState<SystemBranch>('MAIN');
  const [loading, setLoading] = useState(false);

  // 🆕 Sort state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { data, mutate, isLoading } = useSWR<{ data: Place[] }>(
    '/api/frf/places?includeInactive=true',
    fetcher
  );
  const rawPlaces = data?.data || [];

  // 🆕 Sorted places
  const places = useMemo(() => {
    if (!sortColumn) return rawPlaces;
    return [...rawPlaces].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortColumn) {
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'branch': aVal = a.branch; bVal = b.branch; break;
        case 'category': aVal = a.category || ''; bVal = b.category || ''; break;
        case 'isActive': aVal = a.isActive ? 1 : 0; bVal = b.isActive ? 1 : 0; break;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rawPlaces, sortColumn, sortDirection]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const isSuperUser = currentUser?.role === 'SuperUser';

  const handleSave = async () => {
    setLoading(true);
    try {
      const url = editing ? `/api/frf/places?id=${editing.id}` : '/api/frf/places';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, isActive, category, branch }),
      });
      if (res.ok) {
        mutate();
        close();
        setName('');
        setIsActive(true);
        setCategory('REGULAR');
        setBranch('MAIN');
        setEditing(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this place?')) return;
    const res = await fetch(`/api/frf/places?id=${id}`, { method: 'DELETE' });
    if (res.ok) mutate();
  };

  const handleEdit = (p: Place) => {
    setEditing(p);
    setName(p.name);
    setIsActive(p.isActive);
    setCategory(p.category || 'REGULAR');
    setBranch(p.branch || 'MAIN');
    open();
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        {isSuperUser && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null);
              setName('');
              setIsActive(true);
              setCategory('REGULAR');
              open();
            }}
          >
            Add Place
          </Button>
        )}
        {!isSuperUser && (
          <Text size="xs" c="dimmed">
            View-only mode. Only SuperUsers can add, edit, or delete places.
          </Text>
        )}
      </Group>

      <Card withBorder p="0" radius="md" pos="relative">
        <LoadingOverlay visible={isLoading || loading} zIndex={10} overlayProps={{ blur: 2 }} />
        <ScrollArea h="calc(100vh - 320px)">
          <Table
            highlightOnHover
            striped
            withColumnBorders
            verticalSpacing="sm"
            stickyHeader
            horizontalSpacing="md"
            withTableBorder
          >
            <Table.Thead>
              <Table.Tr>
                <SortableTh label="Name" column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableTh label="Branch" column="branch" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableTh label="Category" column="category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableTh label="Status" column="isActive" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                {isSuperUser && <Table.Th style={{ width: 160 }}>Actions</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {places.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={isSuperUser ? 5 : 4}>
                    <Text c="dimmed" ta="center" py="xl">
                      No places yet.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                places.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>{p.name}</Table.Td>
                    <Table.Td>
                      <Badge color="indigo" variant="light">{p.branch}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          p.category === 'CATEGORY_1' ? 'orange' :
                          p.category === 'CATEGORY_2' ? 'red' :
                          'gray'
                        }
                        variant="light"
                      >
                        {p.category === 'CATEGORY_1' ? 'Category 1' :
                         p.category === 'CATEGORY_2' ? 'Category 2' :
                         'Regular'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={p.isActive ? 'green' : 'red'}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    {isSuperUser && (
                      <Table.Td>
                        <Group gap={4}>
                          <Button
                            size="xs"
                            variant="default"
                            onClick={() => handleEdit(p)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="outline"
                            onClick={() => handleDelete(p.id)}
                          >
                            Delete
                          </Button>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      <Modal opened={opened} onClose={close} title={editing ? 'Edit Place' : 'Add Place'} styles={{
        inner: {
          paddingLeft: 'var(--sidebar-offset, 0)',
          transition: 'padding-left 0.25s ease',
        },
      }}>
        <Stack>
          <TextInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
          <Select
            label="Branch"
            description="Which branch does this venue belong to?"
            data={['MAIN', 'IMUS', 'NASTECH', 'SHS']}
            value={branch}
            onChange={(val) => setBranch((val as SystemBranch) || 'MAIN')}
            required
          />
          <Select
            label="Category"
            description="Venue category for event scheduling limits"
            data={[
              { value: 'REGULAR', label: 'Regular (No special limit)' },
              { value: 'CATEGORY_1', label: 'Category 1 (HRM Bar, Multipurpose Room)' },
              { value: 'CATEGORY_2', label: 'Category 2 (NCST Gym, NCST Field, Outside)' },
            ]}
            value={category}
            onChange={(val) => setCategory((val as Place['category']) || 'REGULAR')}
            required
          />
          <Checkbox
            label="Active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={close}>
              Cancel
            </Button>
            <Button loading={loading} onClick={handleSave}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function EquipmentTab({ currentUser }: TabProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<EquipmentItem | null>(null);
  const [name, setName] = useState('');
  const [departmentCode, setDepartmentCode] = useState('ITO-MAIN');
  const [isSingleItem, setIsSingleItem] = useState(false);
  const [quantityAvailable, setQuantityAvailable] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');

    const [branch, setBranch] = useState<SystemBranch | null>(null);
    const [placeIds, setPlaceIds] = useState<string[]>([]);
    const [bundledPlaceIds, setBundledPlaceIds] = useState<string[]>([]);

    const isSuperUser = currentUser?.role === 'SuperUser';

    // 🆕 moved UP here, before placesForBranch
    const { data: placesData } = useSWR<{ data: Place[] }>(
      '/api/frf/places',
      fetcher
    );
    const places = placesData?.data || [];

    // 🆕 now this works
    const placesForBranch = useMemo(
      () => (branch ? places.filter(p => p.branch === branch) : []),
      [places, branch]
    );

  const { data, mutate, isLoading } = useSWR<{ data: EquipmentItem[] }>(
    '/api/frf/equipment',
    fetcher
  );

  const allEquipment = data?.data || [];

  // 🆕 Sort state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  // 🆕 client-side filter + sort
  const equipment = useMemo(() => {
    let filtered = allEquipment;
    if (locationFilter === 'global') {
      filtered = allEquipment.filter(e => !e.branch);
    } else if (locationFilter.startsWith('branch:')) {
      const b = locationFilter.replace('branch:', '');
      filtered = allEquipment.filter(e => e.branch === b && (!e.places || e.places.length === 0));
    } else if (locationFilter !== 'all') {
      filtered = allEquipment.filter(e =>
        e.places?.some(p => p.placeId === locationFilter)
      );
    }

    if (!sortColumn) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortColumn) {
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'department': aVal = a.departmentCode; bVal = b.departmentCode; break;
        case 'branch': aVal = a.branch || ''; bVal = b.branch || ''; break;
        case 'type': aVal = a.isSingleItem ? 'Single Item' : 'Quantity'; bVal = b.isSingleItem ? 'Single Item' : 'Quantity'; break;
        case 'available':
          aVal = a.quantityAvailable - (a.quantityReserved || 0);
          bVal = b.quantityAvailable - (b.quantityReserved || 0);
          break;
        case 'useCount':
          aVal = a.useCount ?? 0;
          bVal = b.useCount ?? 0;
          break;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allEquipment, locationFilter, sortColumn, sortDirection]);

  const handleSave = async () => {
    if (!name || !departmentCode) {
      setError('Name and department are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const url = editing ? `/api/frf/equipment?id=${editing.id}` : '/api/frf/equipment';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          departmentCode,
          branch: branch || null,
          placeIds: branch ? placeIds : [],
          bundledPlaceIds: branch ? bundledPlaceIds : [],
          isSingleItem,
          quantityAvailable: quantityAvailable || 0,
        }),
      });
      if (res.ok) {
        mutate();
        close();
        resetForm();
      } else {
        const d = await res.json();
        setError(d.message || 'Failed to save.');
      }
    } catch {
      setError('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDepartmentCode(currentUser?.departmentCode || 'ITO-MAIN');
    setBranch(null);
    setPlaceIds([]);
    setBundledPlaceIds([]); 
    setIsSingleItem(false);
    setQuantityAvailable(0);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this equipment?')) return;
    const res = await fetch(`/api/frf/equipment?id=${id}`, { method: 'DELETE' });
    if (res.ok) mutate();
  };

  const canAddEquipment =
    isSuperUser ||
    currentUser?.role === 'DepartmentHead' ||
    currentUser?.oic_start != null ||
    currentUser?.oic_end != null;

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Text>Manage available equipment per department and location.</Text>
        <Group>
          <Select
            placeholder="Filter by location"
            data={[
              { value: 'all', label: 'All Equipment' },
              { value: 'global', label: 'Global (Any Branch)' },
              ...(['MAIN', 'IMUS', 'NASTECH', 'SHS'] as const).map(b => ({
                value: `branch:${b}`,
                label: `🏢 ${b} (Branch-wide)`,
              })),
              ...places.map(p => ({ value: p.id, label: `📍 ${p.name} (${p.branch})` })),
            ]}
            value={locationFilter}
            onChange={(val) => setLocationFilter(val || 'all')}
            size="sm"
            w={260}
          />
          {canAddEquipment && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                resetForm();
                setDepartmentCode(currentUser?.departmentCode || 'ITO-MAIN');
                open();
              }}
            >
              Add Equipment
            </Button>
          )}
        </Group>
      </Group>

      <Card withBorder p="0" radius="md" pos="relative">
        <LoadingOverlay visible={isLoading || loading} zIndex={10} overlayProps={{ blur: 2 }} />
        <ScrollArea h="calc(100vh - 320px)">
          <Table highlightOnHover striped withColumnBorders verticalSpacing="sm" stickyHeader horizontalSpacing="md" withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <SortableTh label="Name" column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableTh label="Department" column="department" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableTh label="Location" column="branch" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableTh label="Type" column="type" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableTh label="Available" column="available" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableTh label="Uses" column="useCount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                {(isSuperUser || currentUser?.departmentCode) && (
                  <Table.Th style={{ width: 160 }}>Actions</Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {equipment.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text c="dimmed" ta="center" py="xl">No equipment found.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                equipment.map((e) => (
                  <Table.Tr key={e.id}>
                    <Table.Td>{e.name}</Table.Td>
                    <Table.Td>
                      <Badge color="blue" variant="light">{e.departmentCode}</Badge>
                    </Table.Td>
                    <Table.Td>
                      {!e.branch ? (
                        <Badge color="gray" variant="light">All Branches</Badge>
                      ) : e.places && e.places.length > 0 ? (
                        <Group gap={4}>
                          <Badge color="indigo" variant="light">{e.branch}</Badge>
                          {e.places.map(ep => (
                            <Badge
                              key={ep.placeId}
                              color={ep.isBundled ? 'orange' : 'grape'}
                              variant="light"
                              size="md"
                            >
                              {ep.isBundled ? '⭐ PART OF ' : '📍 '}
                              {ep.place?.name || places.find(p => p.id === ep.placeId)?.name || '—'}
                              {ep.isBundled ? ' EQUIPMENT SET' : ''}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge color="indigo" variant="light">{e.branch}</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{e.isSingleItem ? 'Single Item' : 'Quantity'}</Table.Td>
                    <Table.Td>{e.quantityAvailable - (e.quantityReserved || 0)}</Table.Td>
                    <Table.Td>
                      {e.useCount && e.useCount > 0 ? (
                        <Group gap={4} wrap="nowrap">
                          <Badge color="teal" variant="light" size="md">
                            {e.useCount} {e.useCount === 1 ? 'use' : 'uses'}
                          </Badge>
                          {e.totalDeployedQty !== undefined && e.totalDeployedQty > 0 && !e.isSingleItem && (
                            <Text size="xs" c="dimmed">
                              ({e.totalDeployedQty} qty)
                            </Text>
                          )}
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    {(isSuperUser || currentUser?.departmentCode === e.departmentCode) && (
                      <Table.Td>
                        <Group gap={4}>
                          <Button
                            size="xs"
                            variant="default"
                            onClick={() => {
                              setEditing(e);
                              setName(e.name);
                              setDepartmentCode(e.departmentCode);
                              setBranch(e.branch || null);
                              setPlaceIds(e.places?.map(p => p.placeId) || []);
                              setBundledPlaceIds(
                                e.places?.filter(p => p.isBundled).map(p => p.placeId) || []
                              );
                              setIsSingleItem(e.isSingleItem);
                              setQuantityAvailable(e.quantityAvailable);
                              open();
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="xs" color="red" variant="outline" onClick={() => handleDelete(e.id)}>
                            Delete
                          </Button>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      <Modal opened={opened} onClose={close} title={editing ? 'Edit Equipment' : 'Add Equipment'} size="md" centered styles={{
        inner: {
          paddingLeft: 'var(--sidebar-offset, 0)',
          transition: 'padding-left 0.25s ease',
        },
      }}>
        <Stack>
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          <Select
            label="Department"
            data={['ITO-MAIN', 'PSMO/FMO', 'OP', 'CDO']}
            value={departmentCode}
            onChange={(val) => setDepartmentCode(val || 'PSMO/FMO')}
            required
            disabled={!isSuperUser}
          />
          <Select
            label="Branch"
            description="Leave blank for Global equipment (transportable to any branch)."
            placeholder="Global (Any Branch)"
            data={['MAIN', 'IMUS', 'NASTECH', 'SHS']}
            value={branch}
            onChange={(val) => {
              setBranch((val as SystemBranch) || null);
              setPlaceIds([]);
            }}
            clearable
          />
          {branch && (
            <MultiSelect
              label="Specific Venues (optional)"
              description="Leave empty for 🏢 branch-wide. Select venues to lock to those only."
              placeholder={
                placesForBranch.length === 0
                  ? 'No venues in this branch'
                  : 'Select venues'
              }
              data={placesForBranch.map(p => ({ value: p.id, label: p.name }))}
              value={placeIds}
              onChange={(val) => {
                setPlaceIds(val);
                // Remove bundle flags for venues that are no longer selected
                setBundledPlaceIds(prev => prev.filter(pid => val.includes(pid)));
              }}
              searchable
              clearable
              disabled={placesForBranch.length === 0}
            />
          )}

          {/* 🆕 Bundle as Set Item per venue */}
          {branch && placeIds.length > 0 && (
            <Paper withBorder p="sm" radius="sm" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
              <Text size="xs" fw={600} mb={4}>
                Mark as Set Item for these venues:
              </Text>
              <Text size="xs" c="dimmed" mb="xs">
                Set items will be auto-selected when a user reserves the venue (they can still uncheck).
              </Text>
              <Stack gap={6}>
                {placeIds.map(pid => {
                  const place = places.find(p => p.id === pid);
                  return (
                    <Checkbox
                      key={pid}
                      size="sm"
                      label={place?.name || pid}
                      checked={bundledPlaceIds.includes(pid)}
                      onChange={(e) => {
                        if (e.currentTarget.checked) {
                          setBundledPlaceIds([...bundledPlaceIds, pid]);
                        } else {
                          setBundledPlaceIds(bundledPlaceIds.filter(x => x !== pid));
                        }
                      }}
                    />
                  );
                })}
              </Stack>
            </Paper>
          )}
          <Checkbox
            label="Single Item (e.g., projector, LED wall) – not quantity‑based"
            checked={isSingleItem}
            onChange={(e) => setIsSingleItem(e.currentTarget.checked)}
          />
          <NumberInput
            label="Available Quantity"
            min={0}
            value={quantityAvailable}
            onChange={(val) => setQuantityAvailable(Number(val) || 0)}
            disabled={isSingleItem}
          />
          {error && <Text c="red" size="sm">{error}</Text>}
          <Group justify="flex-end">
            <Button variant="light" onClick={close}>Cancel</Button>
            <Button loading={loading} onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

// === Settings Tab ===
function SettingsTab({ currentUser }: TabProps) {
  const [settings, setSettings] = useState({
    minAdvanceDaysRegular: 7,
    minAdvanceDaysVIP: 1,
    maxEventsPerDay: 2,
    minRescheduleDays: 3,
  });
  const [loading, setLoading] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/frf/settings');
        const result = await res.json();
        if (result.success && result.data) {
          setSettings(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/frf/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minAdvanceDaysRegular: settings.minAdvanceDaysRegular,
          minAdvanceDaysVIP: settings.minAdvanceDaysVIP,
          maxEventsPerDay: settings.maxEventsPerDay,
          minRescheduleDays: settings.minRescheduleDays,
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert('Settings updated successfully!');
        // Optionally update the state with the returned data
        if (result.data) setSettings(result.data);
      } else {
        alert(result.message || 'Failed to update settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('An error occurred while saving settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card withBorder p="md" radius="md">
      <Stack gap="md">
        <Text fw={700} size="lg">FRF Submission Settings</Text>
        <Text size="sm" c="dimmed">
          Configure the minimum advance days required for event submissions.
          These settings apply to all new reservations.
        </Text>

        <SimpleGrid cols={2} spacing="lg">
          <NumberInput
            label="Regular Request (Minimum Advance Days)"
            description="Standard events require this many days before the event date."
            value={settings.minAdvanceDaysRegular}
            onChange={(val) => setSettings({ ...settings, minAdvanceDaysRegular: Number(val) || 0 })}
            min={1}
            max={30}
            required
          />
          <NumberInput
            label="VIP/Tomorrow Request (Minimum Advance Days)"
            description="VIP events with special approval can have shorter notice."
            value={settings.minAdvanceDaysVIP}
            onChange={(val) => setSettings({ ...settings, minAdvanceDaysVIP: Number(val) || 0 })}
            min={0}
            max={7}
            required
          />
          <NumberInput
            label="Maximum Events Per Day"
            description="How many events can be scheduled on the same day."
            value={settings.maxEventsPerDay}
            onChange={(val) => setSettings({ ...settings, maxEventsPerDay: Number(val) || 1 })}
            min={1}
            max={5}
            required
          />
          <NumberInput
            label="Minimum Reschedule Days"
            description="How many days in advance are required when requesting a reschedule."
            value={settings.minRescheduleDays}
            onChange={(val) => setSettings({ ...settings, minRescheduleDays: Number(val) || 3 })}
            min={1}
            max={30}
            required
          />
        </SimpleGrid>

        <Group justify="flex-end">
          <Button loading={loading} onClick={handleSave} color="blue">
            Save Settings
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

// === Main Manage Page ===
export default function ManagePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) {
          setCurrentUser(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setUserLoading(false);
      }
    };
    fetchUser();
  }, []);

  const canManagePlacesAndSettings =
    currentUser?.departmentCode === 'PSMO/FMO' || currentUser?.departmentCode === 'ITO-MAIN';

  const defaultTab = canManagePlacesAndSettings ? 'places' : 'equipment';
  const [activeTab, setActiveTab] = useState<string | null>(defaultTab);

  if (userLoading) {
    return (
      <Container fluid py="md">
        <Card withBorder radius="lg" p="lg">
          <LoadingOverlay visible />
        </Card>
      </Container>
    );
  }

  return (
    <Container fluid py="md">
      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" align="center" mb="md">
          <Title order={2}>Facility / Equipment Management</Title>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push('/dashboard/forms/frf')}
            variant="outline"
            color="gray"
          >
            Back
          </Button>
        </Group>

        <Tabs
          key={canManagePlacesAndSettings ? 'admin' : 'user'}
          value={activeTab}
          onChange={setActiveTab}
          radius="md"
        >
          <Tabs.List>
            {canManagePlacesAndSettings && (
              <Tabs.Tab value="places" leftSection={<IconBuilding size={16} />}>
                Places
              </Tabs.Tab>
            )}
            <Tabs.Tab value="equipment" leftSection={<IconBox size={16} />}>
              Equipment
            </Tabs.Tab>
            {currentUser?.departmentCode === 'ITO-MAIN' && (
              <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
                Settings
              </Tabs.Tab>
            )}
          </Tabs.List>

          {canManagePlacesAndSettings && (
            <Tabs.Panel value="places" pt="md">
              <CollapsibleAlert
                title="Places Management"
                color="blue"
                icon={<IconInfoCircle size={16} />}
              >
                Add, edit, or deactivate venues available for facility reservations. Each place can be
                tagged as <b>Regular</b>, <b>Category 1</b>, or <b>Category 2</b> — categories are used by
                the scheduling rules to limit how many events can happen per day.
                <br /><br />
                Magdagdag, mag‑edit, o mag‑deactivate ng mga venue na pwedeng i‑reserve. Ang bawat lugar ay
                pwedeng i‑tag bilang <b>Regular</b>, <b>Category 1</b>, o <b>Category 2</b> — ginagamit ang
                category ng scheduling rules para limitahan ang bilang ng events kada araw.
              </CollapsibleAlert>
              <PlacesTab currentUser={currentUser} />
            </Tabs.Panel>
          )}

          <Tabs.Panel value="equipment" pt="md">
            <CollapsibleAlert
              title="Equipment Management"
              color="grape"
              icon={<IconInfoCircle size={16} />}
            >
              Manage the equipment catalog per department (ITO‑MAIN, PSMO/FMO, OP, CDO). Mark items as
              <b> Single Item</b> (e.g., projector, LED wall — not quantity‑based) or set a
              <b> quantity available</b> for countable items.
              <br /><br />
              Pamahalaan ang listahan ng kagamitan kada departamento (ITO‑MAIN, PSMO/FMO, OP, CDO). Markahan
              ang item bilang <b>Single Item</b> (hal. projector, LED wall — hindi binibilang) o magtakda ng
              <b> dami</b> para sa mga nabibilang na item.
            </CollapsibleAlert>
            <EquipmentTab currentUser={currentUser} />
          </Tabs.Panel>

          {currentUser?.departmentCode === 'ITO-MAIN' && (
            <Tabs.Panel value="settings" pt="md">
              <CollapsibleAlert
                title="FRF Submission Settings"
                color="teal"
                icon={<IconInfoCircle size={16} />}
              >
                Configure minimum advance days required for new reservations, and the maximum number of
                events allowed per day. These settings apply globally to all facility requests.
                <br /><br />
                I‑configure ang minimum na bilang ng araw bago ang event para makapag‑submit ng bagong
                reservation, at ang maximum na bilang ng events kada araw. Naaapply ang mga setting na ito
                sa lahat ng facility requests.
              </CollapsibleAlert>
              <SettingsTab currentUser={currentUser} />
            </Tabs.Panel>
          )}
        </Tabs>
      </Card>
    </Container>
  );
}