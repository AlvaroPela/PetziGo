import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, Button } from '../../components/FormComponents';

function useQuery() { return new URLSearchParams(useLocation().search); }

const ServiceBooked = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const q = useQuery();
  const orderId = q.get('orderId');

  let summary = null;
  try {
    if (orderId) {
      const raw = localStorage.getItem(`order_summary_${orderId}`);
      if (raw) summary = JSON.parse(raw);
    }
  } catch {}

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-xl mx-auto">
        <Card title="¡Solicitud enviada!" description="Tu reserva fue creada y está pendiente de aceptación del proveedor.">
          <div className="space-y-3 text-slate-700">
            <p>
              Te avisaremos cuando el proveedor acepte la reserva. En ese momento podrás realizar el pago desde tu panel.
            </p>
            {orderId && (
              <p className="text-sm text-slate-600">Número de orden: <span className="font-semibold">#{orderId}</span></p>
            )}
            {summary && (
              <div className="bg-white border rounded p-3 text-sm">
                <div className="font-medium">{summary.title}</div>
                <div>Cantidad: {summary.quantity}</div>
                <div>Total estimado: ${summary.total}</div>
              </div>
            )}
            <div className="pt-2 flex gap-2">
              <Button onClick={() => navigate('/client')}>Ir a mi panel</Button>
              <Button variant="outline" onClick={() => navigate(`/services/${id}`)}>Volver al servicio</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ServiceBooked;
