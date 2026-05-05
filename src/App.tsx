import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getApiConfigError, type Task } from '@/lib/api';
import {
  daysSince,
  deriveNameFromTopcodingUrl,
  isDue,
  sortTasks,
} from '@/lib/tasks';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

type ActiveAction = 'add' | 'fail' | 'solve' | 'update-date' | null;
type FormSubmitHandler = NonNullable<ComponentProps<'form'>['onSubmit']>;

function getRowTone(task: Task): string {
  const days = daysSince(task.lastFailed);

  if (days === null) {
    return 'bg-transparent';
  }

  if (days >= 4) {
    return 'bg-yellow-100/70 dark:bg-yellow-500/15';
  }

  return 'bg-zinc-100/70 dark:bg-zinc-800/50';
}

function formatLastFailed(lastFailed: string | null): string {
  const days = daysSince(lastFailed);

  if (!lastFailed || days === null) {
    return 'Never';
  }

  return `${dateFormatter.format(new Date(lastFailed))} (${days}d)`;
}

function toDateInputValue(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function App() {
  const configError = getApiConfigError();
  const canUseApi = configError === null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [link, setLink] = useState('');
  const [isLoading, setIsLoading] = useState(canUseApi);
  const [isMutating, setIsMutating] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [dateEdits, setDateEdits] = useState<Record<string, string>>({});
  const [editingDateTaskId, setEditingDateTaskId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!canUseApi) {
      return;
    }

    let isCancelled = false;

    api
      .list()
      .then(({ tasks: fetchedTasks }) => {
        if (!isCancelled) {
          setTasks(sortTasks(fetchedTasks));
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          const message =
            error instanceof Error ? error.message : 'Could not load tasks.';
          toast.error(message);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [canUseApi]);

  const dueCount = useMemo(
    () => tasks.filter((task) => isDue(task)).length,
    [tasks],
  );
  const pendingCount = tasks.length - dueCount;
  const isBusy = !canUseApi || isLoading || isMutating;

  const onAddTask = useCallback<FormSubmitHandler>(
    async (event) => {
      event.preventDefault();

      const nextLink = link.trim();

      if (!canUseApi) {
        toast.error(configError ?? 'API is not configured.');
        return;
      }

      if (!nextLink) {
        toast.error('Task link is required.');
        return;
      }

      try {
        new URL(nextLink);
      } catch {
        toast.error('Please enter a valid URL.');
        return;
      }

      const derivedName = deriveNameFromTopcodingUrl(nextLink);

      if (!derivedName) {
        toast.error(
          'Use a valid TopCoding problem URL so the task name can be derived.',
        );
        return;
      }

      setIsMutating(true);
      setActiveTaskId(null);
      setActiveAction('add');

      try {
        const { task } = await api.add(derivedName, nextLink);
        setTasks((previous) => sortTasks([...previous, task]));
        setLink('');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not add task.';
        toast.error(message);
      } finally {
        setIsMutating(false);
        setActiveAction(null);
      }
    },
    [canUseApi, configError, link],
  );

  const onFailTask = useCallback(
    async (id: string) => {
      if (!canUseApi) {
        toast.error(configError ?? 'API is not configured.');
        return;
      }

      setIsMutating(true);
      setActiveTaskId(id);
      setActiveAction('fail');

      try {
        const { task: updatedTask } = await api.fail(id);
        setTasks((previous) =>
          sortTasks(
            previous.map((task) => (task.id === id ? updatedTask : task)),
          ),
        );
        setDateEdits((current) => ({
          ...current,
          [id]: toDateInputValue(updatedTask.lastFailed),
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not fail task.';
        toast.error(message);
      } finally {
        setIsMutating(false);
        setActiveTaskId(null);
        setActiveAction(null);
      }
    },
    [canUseApi, configError],
  );

  const onSolveTask = useCallback(
    async (id: string) => {
      if (!canUseApi) {
        toast.error(configError ?? 'API is not configured.');
        return;
      }

      setIsMutating(true);
      setActiveTaskId(id);
      setActiveAction('solve');

      try {
        await api.solve(id);
        setTasks((previous) => previous.filter((task) => task.id !== id));
        setEditingDateTaskId((current) => (current === id ? null : current));
        setDateEdits((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not solve task.';
        toast.error(message);
      } finally {
        setIsMutating(false);
        setActiveTaskId(null);
        setActiveAction(null);
      }
    },
    [canUseApi, configError],
  );

  const onUpdateLastFailed = useCallback(
    async (id: string) => {
      if (!canUseApi) {
        toast.error(configError ?? 'API is not configured.');
        return;
      }

      const nextDate = dateEdits[id] ?? '';

      if (nextDate && Number.isNaN(new Date(nextDate).getTime())) {
        toast.error('Please enter a valid date.');
        return;
      }

      setIsMutating(true);
      setActiveTaskId(id);
      setActiveAction('update-date');

      try {
        const { task } = await api.updateLastFailed(id, nextDate || null);
        setTasks((previous) =>
          sortTasks(previous.map((item) => (item.id === id ? task : item))),
        );
        setDateEdits((current) => ({
          ...current,
          [id]: toDateInputValue(task.lastFailed),
        }));
        setEditingDateTaskId(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not update failure date.';
        toast.error(message);
      } finally {
        setIsMutating(false);
        setActiveTaskId(null);
        setActiveAction(null);
      }
    },
    [canUseApi, configError, dateEdits],
  );

  return (
    <div className='min-h-screen bg-zinc-50/60 py-8 dark:bg-zinc-950'>
      <main className='mx-auto w-full max-w-4xl space-y-6 px-4'>
        <header className='space-y-1'>
          <h1 className='text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100'>
            Recurring Task Tracker
          </h1>
          <p className='text-sm text-zinc-600 dark:text-zinc-400'>
            Track what failed, what is due, and what is solved.
          </p>
        </header>

        <section className='grid gap-4 sm:grid-cols-3'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Due</CardDescription>
              <CardTitle className='text-3xl text-yellow-600 dark:text-yellow-400'>
                {dueCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Pending</CardDescription>
              <CardTitle className='text-3xl'>{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total</CardDescription>
              <CardTitle className='text-3xl'>{tasks.length}</CardTitle>
            </CardHeader>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Add task</CardTitle>
            <CardDescription>
              Paste a TopCoding problem URL. The task name is derived from it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className='flex flex-col gap-3 sm:flex-row'
              onSubmit={onAddTask}
            >
              <Input
                type='url'
                placeholder='https://app.topcoding.bg/problems/94/binary-tree-inorder-traversal/easy'
                value={link}
                onChange={(event) => setLink(event.target.value)}
                disabled={isBusy}
                required
              />
              <Button type='submit' disabled={isBusy} className='sm:w-auto'>
                {isMutating && activeAction === 'add' ? 'Adding...' : 'Add'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>
              Ordered by oldest failure date first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className='py-8 text-center text-sm text-zinc-600 dark:text-zinc-400'>
                Loading tasks...
              </p>
            ) : !canUseApi ? (
              <p className='py-8 text-center text-sm text-zinc-600 dark:text-zinc-400'>
                {configError}
              </p>
            ) : tasks.length === 0 ? (
              <p className='py-8 text-center text-sm text-zinc-600 dark:text-zinc-400'>
                No tasks yet. Add your first task above.
              </p>
            ) : (
              <>
                <div className='space-y-3 sm:hidden'>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 ${getRowTone(task)}`}
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0 flex-1 space-y-2'>
                          <a
                            href={task.link}
                            target='_blank'
                            rel='noreferrer'
                            className='block break-words font-medium underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-700 dark:decoration-zinc-600 dark:hover:decoration-zinc-200'
                          >
                            {task.name}
                          </a>

                          {editingDateTaskId === task.id ? (
                            <div className='space-y-2'>
                              <Input
                                type='date'
                                className='w-auto'
                                value={
                                  dateEdits[task.id] ??
                                  toDateInputValue(task.lastFailed)
                                }
                                disabled={isBusy}
                                onChange={(event) =>
                                  setDateEdits((current) => ({
                                    ...current,
                                    [task.id]: event.target.value,
                                  }))
                                }
                              />
                              <div className='flex gap-2'>
                                <Button
                                  size='sm'
                                  variant='outline'
                                  disabled={isBusy}
                                  onClick={() =>
                                    void onUpdateLastFailed(task.id)
                                  }
                                >
                                  {isMutating &&
                                  activeTaskId === task.id &&
                                  activeAction === 'update-date'
                                    ? 'Saving...'
                                    : 'Save'}
                                </Button>
                                <Button
                                  size='sm'
                                  variant='ghost'
                                  disabled={isBusy}
                                  onClick={() => {
                                    setDateEdits((current) => ({
                                      ...current,
                                      [task.id]: toDateInputValue(
                                        task.lastFailed,
                                      ),
                                    }));
                                    setEditingDateTaskId(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className='inline-flex items-center gap-2'>
                              <span>{formatLastFailed(task.lastFailed)}</span>
                              <Button
                                size='icon'
                                variant='ghost'
                                disabled={isBusy}
                                aria-label='Edit last failed date'
                                onClick={() => {
                                  setDateEdits((current) => ({
                                    ...current,
                                    [task.id]:
                                      current[task.id] ??
                                      toDateInputValue(task.lastFailed),
                                  }));
                                  setEditingDateTaskId(task.id);
                                }}
                              >
                                <svg
                                  xmlns='http://www.w3.org/2000/svg'
                                  viewBox='0 0 24 24'
                                  fill='none'
                                  stroke='currentColor'
                                  strokeWidth='2'
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  className='size-4'
                                  aria-hidden='true'
                                >
                                  <path d='M12 20h9' />
                                  <path d='m16.5 3.5 4 4L7 21l-4 1 1-4L16.5 3.5z' />
                                </svg>
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className='flex shrink-0 flex-col gap-2'>
                          <Button
                            size='sm'
                            variant='destructive'
                            disabled={isBusy}
                            onClick={() => void onFailTask(task.id)}
                          >
                            {isMutating &&
                            activeTaskId === task.id &&
                            activeAction === 'fail'
                              ? 'Working...'
                              : 'Fail'}
                          </Button>
                          <Button
                            size='sm'
                            variant='success'
                            disabled={isBusy}
                            onClick={() => void onSolveTask(task.id)}
                          >
                            {isMutating &&
                            activeTaskId === task.id &&
                            activeAction === 'solve'
                              ? 'Working...'
                              : 'Solve'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className='hidden sm:block'>
                  <Table className='table-fixed'>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead className='w-[300px]'>Last failed</TableHead>
                        <TableHead className='w-[150px] text-right'>
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task) => (
                        <TableRow key={task.id} className={getRowTone(task)}>
                          <TableCell className='max-w-0 font-medium'>
                            <a
                              href={task.link}
                              target='_blank'
                              rel='noreferrer'
                              className='break-words underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-700 dark:decoration-zinc-600 dark:hover:decoration-zinc-200'
                            >
                              {task.name}
                            </a>
                          </TableCell>
                          <TableCell className='w-[300px] align-top'>
                            {editingDateTaskId === task.id ? (
                              <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                                <Input
                                  type='date'
                                  className='w-auto'
                                  value={
                                    dateEdits[task.id] ??
                                    toDateInputValue(task.lastFailed)
                                  }
                                  disabled={isBusy}
                                  onChange={(event) =>
                                    setDateEdits((current) => ({
                                      ...current,
                                      [task.id]: event.target.value,
                                    }))
                                  }
                                />
                                <div className='flex gap-2'>
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    disabled={isBusy}
                                    onClick={() =>
                                      void onUpdateLastFailed(task.id)
                                    }
                                  >
                                    {isMutating &&
                                    activeTaskId === task.id &&
                                    activeAction === 'update-date'
                                      ? 'Saving...'
                                      : 'Save'}
                                  </Button>
                                  <Button
                                    size='sm'
                                    variant='ghost'
                                    disabled={isBusy}
                                    onClick={() => {
                                      setDateEdits((current) => ({
                                        ...current,
                                        [task.id]: toDateInputValue(
                                          task.lastFailed,
                                        ),
                                      }));
                                      setEditingDateTaskId(null);
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className='inline-flex items-center gap-2'>
                                <span>{formatLastFailed(task.lastFailed)}</span>
                                <Button
                                  size='icon'
                                  variant='ghost'
                                  disabled={isBusy}
                                  aria-label='Edit last failed date'
                                  onClick={() => {
                                    setDateEdits((current) => ({
                                      ...current,
                                      [task.id]:
                                        current[task.id] ??
                                        toDateInputValue(task.lastFailed),
                                    }));
                                    setEditingDateTaskId(task.id);
                                  }}
                                >
                                  <svg
                                    xmlns='http://www.w3.org/2000/svg'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    className='size-4'
                                    aria-hidden='true'
                                  >
                                    <path d='M12 20h9' />
                                    <path d='m16.5 3.5 4 4L7 21l-4 1 1-4L16.5 3.5z' />
                                  </svg>
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className='w-[150px]'>
                            <div className='flex justify-end gap-2'>
                              <Button
                                size='sm'
                                variant='destructive'
                                disabled={isBusy}
                                onClick={() => void onFailTask(task.id)}
                              >
                                {isMutating &&
                                activeTaskId === task.id &&
                                activeAction === 'fail'
                                  ? 'Working...'
                                  : 'Fail'}
                              </Button>
                              <Button
                                size='sm'
                                variant='success'
                                disabled={isBusy}
                                onClick={() => void onSolveTask(task.id)}
                              >
                                {isMutating &&
                                activeTaskId === task.id &&
                                activeAction === 'solve'
                                  ? 'Working...'
                                  : 'Solve'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default App;
