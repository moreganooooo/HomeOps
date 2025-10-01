// app/meals/page.tsx — Sunday Prep + Eli Lunch cards
import SundayPrepWizard from '@/components/SundayPrepWizard'
import LunchCards from '@/components/LunchCards'
export default function MealsPage(){
return (
<div className="space-y-4">
<SundayPrepWizard/>
<LunchCards/>
</div>
)
}