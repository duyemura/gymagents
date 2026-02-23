'use client'

/**
 * NeedsAttentionList — legacy wrapper.
 * The component has been renamed to ToDoList. This file re-exports it
 * for any code still importing NeedsAttentionList directly.
 */

import ToDoList, { ToDoItem, ToDoListProps } from '@/components/ToDoList'
export type { ToDoItem, ToDoListProps }
export default ToDoList
