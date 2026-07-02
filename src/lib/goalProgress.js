// Single source of truth for goal progress — used by /goals, /stats and the
// CSV export so every surface shows identical percentages.
//
// Rules:
// 1. A goal marked completed is always 100%.
// 2. If the goal has linked tasks (tasks.goal_id), progress is the share of
//    completed linked tasks — finishing linked work moves the bar.
// 3. Otherwise fall back to elapsed time between start (start_date or
//    created_at) and target_date.
export function calculateGoalProgress(goal, linkedTasks = []) {
  if (goal.status === 'completed') return 100

  if (linkedTasks.length > 0) {
    const done = linkedTasks.filter(t => t.completed).length
    return Math.round((done / linkedTasks.length) * 100)
  }

  const startStr = goal.start_date || goal.created_at
  if (!startStr || !goal.target_date) return 0
  const start = new Date(startStr).getTime()
  const end   = new Date(goal.target_date).getTime()
  const now   = Date.now()
  if (now >= end)   return 100
  if (now <= start) return 0
  return Math.round(((now - start) / (end - start)) * 100)
}
