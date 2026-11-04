import { Card, Switch, Typography } from 'antd'

const { Text } = Typography

type FloorPlanViewCardProps = {
  floorPlan: boolean
  onChange: (floorPlan: boolean) => void
}

export function FloorPlanViewCard({ floorPlan, onChange }: FloorPlanViewCardProps) {
  return (
    <Card title="平面圖 View" className="view-details">
      <label className="floor-plan-view-setting">
        <Text>此 View 為平面圖（Tag 不排排站，改由簡易畫面點選；不產生群組框）</Text>
        <Switch
          aria-label="平面圖 View"
          checked={floorPlan}
          onChange={onChange}
        />
      </label>
    </Card>
  )
}
