/**
 * KoEduko UI — barrel de primitivas.
 *
 * Uso recomendado:   import { Button, Card, Badge } from '@/components/ui'
 * Importa siempre desde aquí para no depender de rutas internas.
 */

/* superficies */
export { default as Button } from './Button'
export { Card, CardLink, Badge, ProgressBar } from './Card'
export { default as Icon } from './Icon'
export { default as Logo } from './Logo'
export { iconNames } from './iconNames'

/* formularios */
export { Input, Textarea, Select, Checkbox, RadioGroup } from './Field'

/* superposición */
export { default as Modal, ConfirmDialog } from './Modal'

/* estado y feedback */
export { Spinner, Skeleton, SkeletonRow, LoadingState, ErrorState, EmptyState } from './States'
export { default as Alert } from './Alert'
export { ToastProvider } from './Toast'
export { default as useToast } from './useToast'

/* navegación y estructura */
export { PageHeader, Breadcrumbs, PageBody } from './PageHeader'
export { default as Avatar } from './Avatar'
export { default as Tooltip } from './Tooltip'

/* tokens */
export * as tokens from './tokens'
export { palette } from './tokens'