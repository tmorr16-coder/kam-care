'use client'
import { useActionState } from 'react'
import { removeTeam, type FormState } from './actions'

export function RemoveLeader({ teamId, name, openTasks }: { teamId: string; name: string; openTasks: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(removeTeam, {})
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const tasks = openTasks ? `\n\nTheir ${openTasks} open task${openTasks === 1 ? '' : 's'} will go back to Unassigned.` : ''
        if (!confirm(`Remove ${name} from care teams?${tasks}`)) e.preventDefault()
      }}
      className="mt-1"
    >
      <input type="hidden" name="teamId" value={teamId} />
      <button disabled={pending} className="text-xs font-normal text-urgent hover:underline disabled:opacity-50">
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {state.error && <p role="status" className="text-xs font-normal text-urgent">{state.error}</p>}
    </form>
  )
}
