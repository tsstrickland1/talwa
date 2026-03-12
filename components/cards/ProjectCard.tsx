import Link from 'next/link'
import Image from 'next/image'
import { Users, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import type { Project } from '@/lib/types'

type ProjectCardProps = {
  project: Project
}

const statusLabels: Record<Project['status'], string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
}

const statusVariants: Record<Project['status'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  active: 'default',
  completed: 'secondary',
  archived: 'outline',
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="h-full hover:shadow-md transition-all hover:border-talwa-sky overflow-hidden group">
        {project.featured_image && (
          <div className="relative h-48 overflow-hidden">
            <Image
              src={project.featured_image}
              alt={project.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-lg font-semibold text-talwa-navy leading-snug">
              {project.name}
            </h3>
            <Badge variant={statusVariants[project.status]} className="shrink-0 text-xs">
              {statusLabels[project.status]}
            </Badge>
          </div>
          {project.location && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {project.location}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-talwa-navy/80 line-clamp-3 leading-relaxed">
            {project.short_description}
          </p>
        </CardContent>
        <CardFooter className="border-t border-border pt-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{project.contributor_count} contributors</span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
