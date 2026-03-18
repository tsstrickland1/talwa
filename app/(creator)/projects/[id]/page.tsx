import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ProjectIndexPage({ params }: Props) {
  const { id } = await params
  redirect(`/projects/${id}/insights`)
}
