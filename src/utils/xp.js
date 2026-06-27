export const XP_REWARDS = {
  habit_complete: 10,
  task_complete: 15,
  pomodoro_complete: 20,
  journal_write: 25,
  goal_milestone: 50,
}

export async function awardXP(supabase, userId, action) {
  const points = XP_REWARDS[action]
  if (!points) return

  const { data } = await supabase
    .from('user_xp')
    .select('total_xp, level')
    .eq('user_id', userId)
    .single()

  const currentXP = data?.total_xp || 0
  const newXP = currentXP + points
  const newLevel = Math.floor(newXP / 100) + 1

  await supabase.from('user_xp').upsert({
    user_id: userId,
    total_xp: newXP,
    level: newLevel,
    updated_at: new Date().toISOString()
  })

  return { newXP, newLevel, gained: points }
}

export async function checkAndAwardBadge(supabase, userId, badgeId) {
  const { data } = await supabase
    .from('user_badges')
    .select('id')
    .eq('user_id', userId)
    .eq('badge_id', badgeId)
    .single()

  if (data) return false

  await supabase.from('user_badges').insert({ user_id: userId, badge_id: badgeId })
  return true
}
