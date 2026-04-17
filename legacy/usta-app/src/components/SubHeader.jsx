import { useApp } from '../context/AppContext';
import { ChevronLeft } from '@shared/components/Icons';

export default function SubHeader({ title, step, actionLabel, onAction }) {
    const { goBack } = useApp();
    return (
        <div className="sub-header">
            <button className="back-btn" onClick={goBack}><ChevronLeft /></button>
            <span className="sub-header__title">{title}</span>
            {step ? <span className="sub-header__step">{step}</span> :
                actionLabel ? <button className="sub-header__action" onClick={onAction}>{actionLabel}</button> :
                    <span></span>}
        </div>
    );
}
