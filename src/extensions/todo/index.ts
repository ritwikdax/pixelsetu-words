import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

const TODO_LIST_CONTENT = [
  {
    type: 'taskList',
    content: [
      {
        type: 'taskItem',
        attrs: { checked: false },
        content: [{ type: 'paragraph' }],
      },
    ],
  },
  { type: 'paragraph' },
] as const

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    todoList: {
      insertTodoList: () => ReturnType
    }
  }
}

export const TodoTaskItem = TaskItem.configure({
  nested: false,
  HTMLAttributes: {
    class: 'todo-item',
  },
})

export const TodoTaskList = TaskList.extend({
  addCommands() {
    return {
      ...this.parent?.(),
      insertTodoList:
        () =>
        ({ state, chain }) => {
          const { $from } = state.selection
          const parent = $from.parent

          if (parent.isTextblock && parent.content.size === 0) {
            const blockPos = $from.before()
            const blockEnd = blockPos + parent.nodeSize
            return chain()
              .deleteRange({ from: blockPos, to: blockEnd })
              .insertContentAt(blockPos, TODO_LIST_CONTENT)
              .focus()
              .run()
          }

          return chain().insertContent(TODO_LIST_CONTENT).focus().run()
        },
    }
  },
}).configure({
  HTMLAttributes: {
    class: 'todo-list',
  },
})
