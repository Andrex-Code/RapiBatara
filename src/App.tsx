import { startTransition, useDeferredValue, useState } from "react";
import {
  Bell,
  Bike,
  Check,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Truck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { categories, initialAnnouncement, initialOrders, initialProducts } from "./data";
import { formatCurrency } from "./lib/currency";
import { isSupabaseConfigured } from "./lib/supabase";
import type { Announcement, CartItem, Order, OrderStatus, PaymentMethod, Product, Role } from "./types";

const roleOptions: Array<{ id: Role; label: string; icon: typeof UserRound }> = [
  { id: "resident", label: "Vecino", icon: UserRound },
  { id: "owner", label: "Tendero", icon: Store },
  { id: "courier", label: "Domiciliario", icon: Bike },
];

const statusMeta: Record<OrderStatus, { label: string; tone: string }> = {
  draft: { label: "Borrador", tone: "muted" },
  pending_review: { label: "Comprobante pendiente", tone: "warning" },
  approved: { label: "Aprobado", tone: "success" },
  on_route: { label: "En camino", tone: "info" },
  delivered: { label: "Entregado", tone: "muted" },
  rejected: { label: "Rechazado", tone: "danger" },
};

function productById(products: Product[], productId: string) {
  return products.find((product) => product.id === productId);
}

function calculateCartTotal(cart: CartItem[], products: Product[]) {
  return cart.reduce((total, item) => {
    const product = productById(products, item.productId);
    return total + (product?.price ?? 0) * item.quantity;
  }, 0);
}

function App() {
  const [role, setRole] = useState<Role>("resident");
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [cart, setCart] = useState<CartItem[]>([
    { productId: "agua", quantity: 1 },
    { productId: "papas", quantity: 1 },
  ]);
  const [activeCategory, setActiveCategory] = useState("todos");
  const [query, setQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [cashReceived, setCashReceived] = useState("50000");
  const [transferProofName, setTransferProofName] = useState("comprobante-demo.png");
  const [destination, setDestination] = useState("Torre 3, Apto 802");
  const [notes, setNotes] = useState("Entregar en recepción si no contesto.");
  const [announcement, setAnnouncement] = useState<Announcement>(initialAnnouncement);
  const [lastPlacedOrderId, setLastPlacedOrderId] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const cartTotal = calculateCartTotal(cart, products);
  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategory === "todos" || product.categoryId === activeCategory;
    const matchesSearch = [product.name, product.description].join(" ").toLowerCase().includes(deferredQuery);
    return matchesCategory && matchesSearch;
  });

  const activeOrders = orders.filter((order) => order.status !== "delivered" && order.status !== "rejected");
  const lowStockProducts = products.filter((product) => product.stock <= product.lowStockAt);
  const courierOrders = orders.filter((order) => order.status === "approved" || order.status === "on_route");

  function switchRole(nextRole: Role) {
    startTransition(() => setRole(nextRole));
  }

  function updateCart(productId: string, delta: number) {
    setCart((current) => {
      const product = productById(products, productId);
      if (!product) return current;
      const found = current.find((item) => item.productId === productId);
      if (!found && delta > 0) {
        return [...current, { productId, quantity: 1 }];
      }

      return current
        .map((item) => {
          if (item.productId !== productId) return item;
          return { ...item, quantity: Math.min(product.stock, Math.max(0, item.quantity + delta)) };
        })
        .filter((item) => item.quantity > 0);
    });
  }

  function placeOrder() {
    if (cart.length === 0) return;
    const cashValue = Number(cashReceived) || 0;
    const cashMissing = paymentMethod === "cash" ? Math.max(0, cartTotal - cashValue) : 0;
    const transferMissingProof = paymentMethod === "transfer" && transferProofName.trim().length === 0;
    const hasUnavailableItems = cart.some((item) => (productById(products, item.productId)?.stock ?? 0) < item.quantity);
    if (destination.trim().length === 0 || transferMissingProof || hasUnavailableItems || (paymentMethod === "cash" && cashMissing > 0)) {
      return;
    }

    const items = cart.flatMap((item) => {
      const product = productById(products, item.productId);
      if (!product) return [];
      return [
        {
          productId: product.id,
          name: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
        },
      ];
    });
    const nextOrder: Order = {
      id: `RB-${1043 + orders.length}`,
      customerName: "Pedido rápido",
      destination: `Conjunto Batará, ${destination}`,
      createdAt: "Ahora",
      status: "pending_review",
      paymentMethod,
      transferProofName: paymentMethod === "transfer" ? transferProofName : undefined,
      cashReceived: paymentMethod === "cash" ? cashValue : undefined,
      changeDue: paymentMethod === "cash" ? Math.max(0, cashValue - cartTotal) : undefined,
      notes,
      items,
      total: cartTotal,
      cashMissing: paymentMethod === "cash" ? cashMissing : undefined,
    };

    setOrders((current) => [nextOrder, ...current]);
    setLastPlacedOrderId(nextOrder.id);
    setProducts((current) =>
      current.map((product) => {
        const sold = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
        return sold ? { ...product, stock: Math.max(0, product.stock - sold) } : product;
      }),
    );
    setCart([]);
  }

  function updateOrderStatus(orderId: string, status: OrderStatus) {
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));
  }

  function adjustStock(productId: string, delta: number) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, stock: Math.max(0, product.stock + delta) } : product,
      ),
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand-block">
          <div className="brand-mark">RB</div>
          <div>
            <strong>RapiBatará</strong>
            <span>Tienda del conjunto</span>
          </div>
        </div>

        <nav className="role-switcher" aria-label="Cambiar rol">
          {roleOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                className={role === option.id ? "role-button active" : "role-button"}
                key={option.id}
                onClick={() => switchRole(option.id)}
                type="button"
              >
                <Icon aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <ShieldCheck aria-hidden="true" />
          <span>{isSupabaseConfigured ? "Supabase conectado" : "Modo demo local"}</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="section-label">Operación en vivo</p>
            <h1>{role === "resident" ? "Compra rápida" : role === "owner" ? "Control del tendero" : "Ruta de entrega"}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Mensajes">
              <MessageCircle aria-hidden="true" />
            </button>
            <button className="icon-button" type="button" aria-label="Notificaciones">
              <Bell aria-hidden="true" />
            </button>
            <button className="primary-action" type="button">
              <Settings aria-hidden="true" />
              Ajustes
            </button>
          </div>
        </header>

        <section className="metrics-grid" aria-label="Resumen operativo">
          <MetricCard icon={ShoppingBasket} label="Pedidos activos" value={String(activeOrders.length)} detail="pendientes por resolver" />
          <MetricCard icon={Wallet} label="Venta del día" value={formatCurrency(orders.reduce((sum, order) => sum + order.total, 0))} detail="digital + efectivo" />
          <MetricCard icon={Package} label="Stock bajo" value={String(lowStockProducts.length)} detail="requiere revisión" />
        </section>

        {role === "resident" && (
          <ResidentView
            activeCategory={activeCategory}
            cart={cart}
            cartTotal={cartTotal}
            cashReceived={cashReceived}
            destination={destination}
            filteredProducts={filteredProducts}
            lastPlacedOrderId={lastPlacedOrderId}
            notes={notes}
            orders={orders}
            paymentMethod={paymentMethod}
            products={products}
            query={query}
            transferProofName={transferProofName}
            onCashReceivedChange={setCashReceived}
            onCategoryChange={setActiveCategory}
            onDestinationChange={setDestination}
            onNotesChange={setNotes}
            onPaymentMethodChange={setPaymentMethod}
            onPlaceOrder={placeOrder}
            onQueryChange={setQuery}
            onTransferProofChange={setTransferProofName}
            onUpdateCart={updateCart}
          />
        )}

        {role === "owner" && (
          <OwnerView
            announcement={announcement}
            lowStockProducts={lowStockProducts}
            orders={orders}
            products={products}
            onAdjustStock={adjustStock}
            onAnnouncementChange={setAnnouncement}
            onOrderStatusChange={updateOrderStatus}
          />
        )}

        {role === "courier" && <CourierView orders={courierOrders} onOrderStatusChange={updateOrderStatus} />}
      </main>
    </div>
  );
}

type MetricCardProps = {
  icon: typeof ShoppingBasket;
  label: string;
  value: string;
  detail: string;
};

function MetricCard({ icon: Icon, label, value, detail }: MetricCardProps) {
  return (
    <article className="metric-card">
      <Icon aria-hidden="true" />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

type ResidentViewProps = {
  activeCategory: string;
  cart: CartItem[];
  cartTotal: number;
  cashReceived: string;
  destination: string;
  filteredProducts: Product[];
  lastPlacedOrderId: string | null;
  notes: string;
  orders: Order[];
  paymentMethod: PaymentMethod;
  products: Product[];
  query: string;
  transferProofName: string;
  onCashReceivedChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onPlaceOrder: () => void;
  onQueryChange: (value: string) => void;
  onTransferProofChange: (value: string) => void;
  onUpdateCart: (productId: string, delta: number) => void;
};

function ResidentView(props: ResidentViewProps) {
  const cashValue = Number(props.cashReceived) || 0;
  const cashMissing = Math.max(0, props.cartTotal - cashValue);
  const cashIsIncomplete = props.paymentMethod === "cash" && cashMissing > 0;
  const transferMissingProof = props.paymentMethod === "transfer" && props.transferProofName.trim().length === 0;
  const destinationMissing = props.destination.trim().length === 0;
  const hasUnavailableItems = props.cart.some((item) => (productById(props.products, item.productId)?.stock ?? 0) < item.quantity);
  const cannotSubmit =
    props.cart.length === 0 || cashIsIncomplete || transferMissingProof || destinationMissing || hasUnavailableItems;
  const trackedOrder =
    props.orders.find((order) => order.id === props.lastPlacedOrderId) ??
    props.orders.find((order) => order.status !== "delivered" && order.status !== "rejected") ??
    props.orders[0];

  return (
    <div className="content-grid">
      <section className="catalog-panel">
        <div className="panel-heading">
          <div>
            <p className="section-label">Catálogo</p>
            <h2>Productos listos para pedir</h2>
          </div>
          <label className="search-box">
            <Search aria-hidden="true" />
            <input
              value={props.query}
              onChange={(event) => props.onQueryChange(event.target.value)}
              placeholder="Buscar arroz, agua, aseo..."
            />
          </label>
        </div>

        <div className="category-tabs" aria-label="Categorías">
          <button className={props.activeCategory === "todos" ? "active" : ""} onClick={() => props.onCategoryChange("todos")} type="button">
            Todos
          </button>
          {categories.map((category) => (
            <button
              className={props.activeCategory === category.id ? "active" : ""}
              key={category.id}
              onClick={() => props.onCategoryChange(category.id)}
              type="button"
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="product-grid">
          {props.filteredProducts.map((product) => {
            const quantity = props.cart.find((item) => item.productId === product.id)?.quantity ?? 0;
            return (
              <article className="product-card" key={product.id}>
                <div className="product-image" aria-hidden="true">
                  {product.image}
                </div>
                <div className="product-copy">
                  <div>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                  </div>
                  <div className="product-meta">
                    <strong>{formatCurrency(product.price)}</strong>
                    <span className={product.stock <= product.lowStockAt ? "stock-chip warning" : "stock-chip"}>
                      {product.stock} disponibles
                    </span>
                  </div>
                </div>
                <div className="quantity-control" aria-label={`Cantidad para ${product.name}`}>
                  <button onClick={() => props.onUpdateCart(product.id, -1)} type="button" aria-label="Quitar">
                    <Minus aria-hidden="true" />
                  </button>
                  <span>{quantity}</span>
                  <button
                    onClick={() => props.onUpdateCart(product.id, 1)}
                    type="button"
                    aria-label="Agregar"
                    disabled={quantity >= product.stock}
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="checkout-panel">
        <div className="panel-heading compact">
          <div>
            <p className="section-label">Checkout</p>
            <h2>Tu pedido</h2>
          </div>
          <ShoppingBasket aria-hidden="true" />
        </div>

        <div className="cart-list">
          {props.cart.length === 0 ? (
            <p className="empty-state">Agrega productos para crear un pedido.</p>
          ) : (
            props.cart.map((item) => {
              const product = productById(props.products, item.productId);
              if (!product) return null;
              return (
                <div className="cart-row" key={item.productId}>
                  <span>{product.name}</span>
                  <strong>
                    {item.quantity} x {formatCurrency(product.price)}
                  </strong>
                </div>
              );
            })
          )}
        </div>

        <label className="field-label">
          Dirección
          <input value={props.destination} onChange={(event) => props.onDestinationChange(event.target.value)} />
        </label>

        <label className="field-label">
          Nota
          <textarea value={props.notes} onChange={(event) => props.onNotesChange(event.target.value)} rows={3} />
        </label>

        <div className="payment-toggle" aria-label="Método de pago">
          <button
            className={props.paymentMethod === "transfer" ? "active" : ""}
            onClick={() => props.onPaymentMethodChange("transfer")}
            type="button"
          >
            <CreditCard aria-hidden="true" />
            Transferencia
          </button>
          <button
            className={props.paymentMethod === "cash" ? "active" : ""}
            onClick={() => props.onPaymentMethodChange("cash")}
            type="button"
          >
            <Wallet aria-hidden="true" />
            Efectivo
          </button>
        </div>

        {props.paymentMethod === "transfer" ? (
          <label className={transferMissingProof ? "file-drop invalid" : "file-drop"}>
            <ClipboardCheck aria-hidden="true" />
            <span>{props.transferProofName || "Subir comprobante"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => props.onTransferProofChange(event.target.files?.[0]?.name ?? "")}
            />
          </label>
        ) : (
          <label className="field-label">
            Pago con
            <input
              inputMode="numeric"
              value={props.cashReceived}
              onChange={(event) => props.onCashReceivedChange(event.target.value)}
              aria-invalid={cashIsIncomplete ? "true" : undefined}
            />
            <small>
              {cashIsIncomplete
                ? `Faltan ${formatCurrency(cashMissing)} para completar el pago.`
                : `Cambio estimado: ${formatCurrency(Math.max(0, cashValue - props.cartTotal))}`}
            </small>
          </label>
        )}

        {(cashIsIncomplete || transferMissingProof || destinationMissing || hasUnavailableItems) && (
          <p className="payment-warning" role="alert">
            {cashIsIncomplete
              ? "El efectivo no alcanza para este pedido. Completa el monto o cambia a transferencia para poder enviar."
              : transferMissingProof
                ? "Adjunta el comprobante de transferencia antes de enviar el pedido."
                : destinationMissing
                  ? "Agrega torre, apartamento o conjunto para evitar confusiones en el domicilio."
                  : "Ajusta las cantidades: hay productos por encima del stock disponible."}
          </p>
        )}

        <div className="total-row">
          <span>Total</span>
          <strong>{formatCurrency(props.cartTotal)}</strong>
        </div>
        <button className="checkout-button" onClick={props.onPlaceOrder} type="button" disabled={cannotSubmit}>
          Enviar para aprobación
          <ChevronRight aria-hidden="true" />
        </button>

        {trackedOrder && <TrackingCard order={trackedOrder} />}
      </aside>
    </div>
  );
}

const trackingSteps: Array<{ status: OrderStatus; label: string }> = [
  { status: "pending_review", label: "Revisión" },
  { status: "approved", label: "Aprobado" },
  { status: "on_route", label: "En camino" },
  { status: "delivered", label: "Entregado" },
];

function TrackingCard({ order }: { order: Order }) {
  const currentIndex = Math.max(
    0,
    trackingSteps.findIndex((step) => step.status === order.status),
  );

  return (
    <section className="tracking-card" aria-label="Seguimiento del pedido">
      <div className="panel-heading compact">
        <div>
          <p className="section-label">Seguimiento</p>
          <h2>{order.id}</h2>
        </div>
        <span className={`status-chip ${statusMeta[order.status].tone}`}>{statusMeta[order.status].label}</span>
      </div>
      <div className="tracking-steps">
        {trackingSteps.map((step, index) => (
          <div
            className={index <= currentIndex ? "tracking-step done" : "tracking-step"}
            key={step.status}
          >
            <span>{index < currentIndex ? <Check aria-hidden="true" /> : index + 1}</span>
            <small>{step.label}</small>
          </div>
        ))}
      </div>
      <p className="tracking-copy">
        {order.status === "on_route"
          ? "Tu pedido ya va en camino. Ten a mano el efectivo o revisa recepción."
          : order.status === "approved"
            ? "El tendero aprobó el pedido. El domiciliario puede recogerlo."
            : order.status === "delivered"
              ? "Pedido entregado y cerrado."
              : "El tendero está revisando el pago antes de enviarlo a despacho."}
      </p>
    </section>
  );
}

type OwnerViewProps = {
  announcement: Announcement;
  lowStockProducts: Product[];
  orders: Order[];
  products: Product[];
  onAdjustStock: (productId: string, delta: number) => void;
  onAnnouncementChange: (announcement: Announcement) => void;
  onOrderStatusChange: (orderId: string, status: OrderStatus) => void;
};

function OwnerView({ announcement, lowStockProducts, orders, products, onAdjustStock, onAnnouncementChange, onOrderStatusChange }: OwnerViewProps) {
  return (
    <div className="owner-grid">
      <section className="orders-panel">
        <div className="panel-heading">
          <div>
            <p className="section-label">Pedidos</p>
            <h2>Aprobación del tendero</h2>
          </div>
          <span className="sync-pill">RLS + auditoría</span>
        </div>
        <div className="order-stack">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order}>
              {order.status === "pending_review" && (
                <>
                  {(Boolean(order.cashMissing && order.cashMissing > 0) ||
                    (order.paymentMethod === "transfer" && !order.transferProofName)) && (
                    <p className="payment-warning">Este pedido necesita corrección del pago antes de aprobarse.</p>
                  )}
                  <div className="button-row">
                    <button
                      className="approve-button"
                      onClick={() => onOrderStatusChange(order.id, "approved")}
                      type="button"
                      disabled={Boolean(order.cashMissing && order.cashMissing > 0) || (order.paymentMethod === "transfer" && !order.transferProofName)}
                    >
                      <Check aria-hidden="true" />
                      Aprobar
                    </button>
                    <button className="reject-button" onClick={() => onOrderStatusChange(order.id, "rejected")} type="button">
                      <X aria-hidden="true" />
                      Rechazar
                    </button>
                  </div>
                </>
              )}
            </OrderCard>
          ))}
        </div>
      </section>

      <aside className="operations-rail">
        <section className="mini-panel">
          <div className="panel-heading compact">
            <div>
              <p className="section-label">Inventario</p>
              <h2>Stock bajo</h2>
            </div>
            <Package aria-hidden="true" />
          </div>
          <div className="stock-list">
            {lowStockProducts.map((product) => (
              <div className="stock-row" key={product.id}>
                <span>{product.name}</span>
                <div className="quantity-control small">
                  <button onClick={() => onAdjustStock(product.id, -1)} type="button" aria-label="Reducir stock">
                    <Minus aria-hidden="true" />
                  </button>
                  <strong>{product.stock}</strong>
                  <button onClick={() => onAdjustStock(product.id, 1)} type="button" aria-label="Subir stock">
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mini-panel">
          <div className="panel-heading compact">
            <div>
              <p className="section-label">Anuncio</p>
              <h2>Ventana inicial</h2>
            </div>
            <Bell aria-hidden="true" />
          </div>
          <label className="switch-row">
            <span>Activo</span>
            <input
              type="checkbox"
              checked={announcement.active}
              onChange={(event) => onAnnouncementChange({ ...announcement, active: event.target.checked })}
            />
          </label>
          <label className="field-label">
            Título
            <input value={announcement.title} onChange={(event) => onAnnouncementChange({ ...announcement, title: event.target.value })} />
          </label>
          <label className="field-label">
            Mensaje
            <textarea
              value={announcement.body}
              onChange={(event) => onAnnouncementChange({ ...announcement, body: event.target.value })}
              rows={3}
            />
          </label>
        </section>

        <section className="mini-panel">
          <div className="panel-heading compact">
            <div>
              <p className="section-label">Productos</p>
              <h2>Catálogo vivo</h2>
            </div>
            <Store aria-hidden="true" />
          </div>
          <div className="catalog-list">
            {products.slice(0, 5).map((product) => (
              <div className="catalog-row" key={product.id}>
                <span>{product.image}</span>
                <div>
                  <strong>{product.name}</strong>
                  <small>{formatCurrency(product.price)}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

type CourierViewProps = {
  orders: Order[];
  onOrderStatusChange: (orderId: string, status: OrderStatus) => void;
};

function CourierView({ orders, onOrderStatusChange }: CourierViewProps) {
  return (
    <div className="courier-layout">
      <section className="orders-panel">
        <div className="panel-heading">
          <div>
            <p className="section-label">Domicilios</p>
            <h2>Pedidos aprobados para recoger</h2>
          </div>
          <Truck aria-hidden="true" />
        </div>
        <div className="order-stack">
          {orders.length === 0 ? (
            <p className="empty-state">No hay pedidos aprobados por ahora.</p>
          ) : (
            orders.map((order) => (
              <OrderCard key={order.id} order={order}>
                <div className="button-row">
                  {order.status === "approved" && (
                    <button className="approve-button" onClick={() => onOrderStatusChange(order.id, "on_route")} type="button">
                      <Truck aria-hidden="true" />
                      En camino
                    </button>
                  )}
                  {order.status === "on_route" && (
                    <button className="checkout-button slim" onClick={() => onOrderStatusChange(order.id, "delivered")} type="button">
                      <Check aria-hidden="true" />
                      Entregado
                    </button>
                  )}
                </div>
              </OrderCard>
            ))
          )}
        </div>
      </section>

      <aside className="route-card">
        <p className="section-label">Ruta sugerida</p>
        <h2>Primero dentro del conjunto</h2>
        <ol>
          <li>Recepción Torre 1</li>
          <li>Torre 3, Apto 802</li>
          <li>Conjunto vecino Cedros</li>
        </ol>
      </aside>
    </div>
  );
}

type OrderCardProps = {
  children?: React.ReactNode;
  order: Order;
};

function OrderCard({ children, order }: OrderCardProps) {
  const status = statusMeta[order.status];
  const cashSummary =
    order.paymentMethod === "transfer"
      ? `Transferencia: ${order.transferProofName}`
      : order.cashMissing && order.cashMissing > 0
        ? `Efectivo recibido ${formatCurrency(order.cashReceived ?? 0)} · faltan ${formatCurrency(order.cashMissing)}`
        : `Efectivo: cambio ${formatCurrency(order.changeDue ?? 0)}`;

  return (
    <article className="order-card">
      <div className="order-topline">
        <div>
          <strong>{order.id}</strong>
          <span>{order.createdAt}</span>
        </div>
        <span className={`status-chip ${status.tone}`}>{status.label}</span>
      </div>
      <div className="order-destination">
        <Truck aria-hidden="true" />
        <span>{order.destination}</span>
      </div>
      <div className="order-items">
        {order.items.map((item) => (
          <div key={`${order.id}-${item.productId}`}>
            <span>
              {item.quantity} x {item.name}
            </span>
            <strong>{formatCurrency(item.quantity * item.unitPrice)}</strong>
          </div>
        ))}
      </div>
      <div className="payment-summary">
        <span>{cashSummary}</span>
        <strong>{formatCurrency(order.total)}</strong>
      </div>
      {order.notes && <p className="order-note">{order.notes}</p>}
      {children}
    </article>
  );
}

export default App;
