import os
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
db_url = os.getenv("DATABASE_URL", "sqlite:///mobistock_dev.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgresql://") and "+psycopg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
db = SQLAlchemy(app)

origins = os.getenv("FRONTEND_ORIGIN", "*")
CORS(app, resources={r"/api/*": {"origins": origins.split(",") if origins != "*" else "*"}})


class WorkspaceSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    shop_name = db.Column(db.String(120), nullable=False, default="Accra Mini Mart")
    shop_location = db.Column(db.String(160), nullable=False, default="Accra, Ghana")
    currency = db.Column(db.String(3), nullable=False, default="GHS")
    owner_name = db.Column(db.String(120), nullable=False, default="MobiStock Administrator")
    owner_email = db.Column(db.String(160), nullable=False, default="")
    owner_phone = db.Column(db.String(40), nullable=False, default="")

def settings_json(s):
    return {"shop_name":s.shop_name,"shop_location":s.shop_location,"currency":s.currency,
            "owner_name":s.owner_name,"owner_email":s.owner_email,"owner_phone":s.owner_phone}

def get_settings():
    s=db.session.get(WorkspaceSettings,1)
    if not s:
        s=WorkspaceSettings(id=1)
        db.session.add(s)
        db.session.commit()
    return s

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(140), nullable=False)
    sku = db.Column(db.String(50), nullable=False, unique=True, index=True)
    category = db.Column(db.String(80), nullable=False, default="General")
    quantity = db.Column(db.Integer, nullable=False, default=0)
    min_stock = db.Column(db.Integer, nullable=False, default=5)
    unit_cost = db.Column(db.Numeric(12,2), nullable=False, default=0)
    unit_price = db.Column(db.Numeric(12,2), nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Movement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=False, index=True)
    product_name = db.Column(db.String(140), nullable=False)
    type = db.Column(db.String(3), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    note = db.Column(db.String(240), default="")
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

def product_json(p):
    return {"id":p.id,"name":p.name,"sku":p.sku,"category":p.category,"quantity":p.quantity,
            "min_stock":p.min_stock,"unit_cost":float(p.unit_cost or 0),"unit_price":float(p.unit_price or 0)}
def movement_json(m):
    return {"id":m.id,"product_id":m.product_id,"product_name":m.product_name,"type":m.type,
            "quantity":m.quantity,"note":m.note,"created_at":m.created_at.isoformat() if m.created_at else None}
def error(message, code=400):
    return jsonify({"error":message}), code
def as_int(value, field, minimum=0):
    try:
        n=int(value)
        if str(value).strip() != str(n) and not isinstance(value,int): raise ValueError()
        if n < minimum: raise ValueError()
        return n
    except (TypeError,ValueError):
        raise ValueError(f"{field} must be a whole number of at least {minimum}.")
def as_decimal(value, field):
    try:
        n=Decimal(str(value or 0))
        if not n.is_finite() or n < 0: raise InvalidOperation()
        return n
    except (InvalidOperation,ValueError):
        raise ValueError(f"{field} must be a valid non-negative amount.")

def seed_if_empty():
    if Product.query.count(): return
    sample=[
      ("Royal Aroma Rice 5kg","GRC-001","Grains",24,8,115,145),
      ("Frytol Cooking Oil 1L","OIL-014","Cooking essentials",3,5,28,35),
      ("Peak Milk Powder 400g","MLK-008","Dairy",0,4,48,58),
      ("Gino Tomato Paste 210g","TMT-022","Canned goods",18,6,8,11),
      ("Key Soap 160g","HYG-006","Household",26,8,7,9),
      ("Ideal Evaporated Milk","MLK-011","Dairy",7,6,13,16),
    ]
    for row in sample:
        p=Product(name=row[0],sku=row[1],category=row[2],quantity=row[3],min_stock=row[4],
                  unit_cost=Decimal(str(row[5])),unit_price=Decimal(str(row[6])))
        db.session.add(p)
    db.session.commit()
    # Record each illustrative opening balance so the movement ledger has a
    # traceable starting point. These are sample records, not real shop activity.
    for p in Product.query.all():
        if p.quantity > 0:
            db.session.add(Movement(product_id=p.id,product_name=p.name,type="in",
                                    quantity=p.quantity,note="Illustrative opening balance"))
    db.session.commit()


@app.get("/api/settings")
def read_settings():
    return jsonify({"settings":settings_json(get_settings())})

@app.put("/api/settings")
def update_settings():
    data=request.get_json(silent=True) or {}
    try:
        s=get_settings()
        shop_name=(data.get("shop_name") or "").strip()
        owner_name=(data.get("owner_name") or "").strip()
        if not shop_name:
            return error("Shop name is required.")
        if not owner_name:
            return error("Owner name is required.")
        email=(data.get("owner_email") or "").strip()
        if email and ("@" not in email or "." not in email.split("@")[-1]):
            return error("Enter a valid email address.")
        currency=(data.get("currency") or "GHS").strip().upper()
        if currency != "GHS":
            return error("The current workspace is configured for Ghana cedi (GHS).")
        s.shop_name=shop_name[:120]
        s.shop_location=(data.get("shop_location") or "").strip()[:160]
        s.currency=currency
        s.owner_name=owner_name[:120]
        s.owner_email=email[:160]
        s.owner_phone=(data.get("owner_phone") or "").strip()[:40]
        db.session.commit()
        return jsonify({"settings":settings_json(s)})
    except Exception:
        db.session.rollback()
        return error("Could not save workspace settings.",500)

@app.get("/api/health")
def health():
    try:
        db.session.execute(db.text("SELECT 1"))
        return jsonify({"status":"ok","database":"connected","service":"MobiStock API"})
    except Exception:
        return error("Database connection failed.",503)

@app.get("/api/products")
def list_products():
    seed_if_empty()
    rows=Product.query.order_by(Product.name.asc()).all()
    return jsonify({"products":[product_json(p) for p in rows]})

@app.post("/api/products")
def create_product():
    seed_if_empty()
    data=request.get_json(silent=True) or {}
    try:
        name=(data.get("name") or "").strip()
        sku=(data.get("sku") or "").strip().upper()
        category=(data.get("category") or "General").strip()
        if not name or not sku: return error("Product name and SKU are required.")
        if Product.query.filter_by(sku=sku).first(): return error("That SKU already exists.")
        p=Product(name=name,sku=sku,category=category,
          quantity=as_int(data.get("quantity",0),"Opening quantity"),
          min_stock=as_int(data.get("min_stock",5),"Minimum stock"),
          unit_cost=as_decimal(data.get("unit_cost",0),"Unit cost"),
          unit_price=as_decimal(data.get("unit_price",0),"Selling price"))
        db.session.add(p);db.session.commit()
        return jsonify({"product":product_json(p)}),201
    except ValueError as e: db.session.rollback();return error(str(e))
    except Exception: db.session.rollback();return error("Could not create product. Check the submitted details.",500)

@app.put("/api/products/<int:product_id>")
def update_product(product_id):
    p=db.session.get(Product,product_id)
    if not p:return error("Product not found.",404)
    data=request.get_json(silent=True) or {}
    try:
        name=(data.get("name") or "").strip();sku=(data.get("sku") or "").strip().upper()
        if not name or not sku:return error("Product name and SKU are required.")
        existing=Product.query.filter(Product.sku==sku,Product.id!=p.id).first()
        if existing:return error("That SKU is already assigned to another product.")
        p.name=name;p.sku=sku;p.category=(data.get("category") or "General").strip()
        p.min_stock=as_int(data.get("min_stock",p.min_stock),"Minimum stock")
        p.unit_cost=as_decimal(data.get("unit_cost",p.unit_cost),"Unit cost")
        p.unit_price=as_decimal(data.get("unit_price",p.unit_price),"Selling price")
        db.session.commit()
        return jsonify({"product":product_json(p)})
    except ValueError as e:db.session.rollback();return error(str(e))
    except Exception:db.session.rollback();return error("Could not update product.",500)

@app.get("/api/movements")
def list_movements():
    seed_if_empty()
    limit=min(max(request.args.get("limit",default=100,type=int),1),500)
    rows=Movement.query.order_by(Movement.created_at.desc()).limit(limit).all()
    return jsonify({"movements":[movement_json(m) for m in rows]})

@app.post("/api/movements")
def create_movement():
    seed_if_empty()
    data=request.get_json(silent=True) or {}
    try:
        product_id=as_int(data.get("product_id"),"Product",1)
        qty=as_int(data.get("quantity"),"Quantity",1)
        typ=data.get("type")
        if typ not in ("in","out"):return error("Movement type must be 'in' or 'out'.")
        p=db.session.get(Product,product_id)
        if not p:return error("Product not found.",404)
        if typ=="out" and qty>p.quantity:return error(f"Only {p.quantity} units are currently available.")
        p.quantity=p.quantity+qty if typ=="in" else p.quantity-qty
        m=Movement(product_id=p.id,product_name=p.name,type=typ,quantity=qty,
                   note=(data.get("note") or "").strip()[:240])
        db.session.add(m);db.session.commit()
        return jsonify({"movement":movement_json(m),"product":product_json(p)}),201
    except ValueError as e:db.session.rollback();return error(str(e))
    except Exception:db.session.rollback();return error("Could not record stock movement.",500)


@app.get("/api/intelligence")
def inventory_intelligence():
    """Operational inventory signals derived from current balances and the 30-day movement ledger."""
    seed_if_empty()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now - timedelta(days=30)
    products = Product.query.order_by(Product.name.asc()).all()
    movements = Movement.query.filter(Movement.created_at >= cutoff).order_by(Movement.created_at.desc()).all()

    outbound = {}
    inbound_units = 0
    outbound_units = 0
    for movement in movements:
        if movement.type == "out":
            outbound[movement.product_id] = outbound.get(movement.product_id, 0) + movement.quantity
            outbound_units += movement.quantity
        elif movement.type == "in":
            inbound_units += movement.quantity

    low = [p for p in products if 0 < p.quantity <= p.min_stock]
    out = [p for p in products if p.quantity == 0]
    healthy = max(0, len(products) - len(low) - len(out))
    health = round((healthy / len(products)) * 100) if products else 100

    movers = []
    restock = []
    categories = {}
    for p in products:
        sold_units = outbound.get(p.id, 0)
        daily_rate = sold_units / 30
        cover_days = round(p.quantity / daily_rate, 1) if daily_rate > 0 else None
        days_to_min = round((p.quantity - p.min_stock) / daily_rate, 1) if daily_rate > 0 and p.quantity > p.min_stock else (0 if p.quantity <= p.min_stock and daily_rate > 0 else None)
        if sold_units:
            movers.append({
                "product_id": p.id, "name": p.name, "sku": p.sku,
                "units_out": sold_units, "daily_rate": round(daily_rate, 2),
                "cover_days": cover_days, "days_to_minimum": days_to_min,
                "quantity": p.quantity, "min_stock": p.min_stock
            })
        if p.quantity <= p.min_stock:
            restock.append({
                "product_id": p.id, "name": p.name, "sku": p.sku,
                "quantity": p.quantity, "min_stock": p.min_stock,
                "gap": max(0, p.min_stock - p.quantity),
                "status": "out" if p.quantity == 0 else "low"
            })
        c = categories.setdefault(p.category or "General", {"category": p.category or "General", "units": 0, "value": 0.0, "products": 0})
        c["units"] += p.quantity
        c["value"] += float(p.unit_cost or 0) * p.quantity
        c["products"] += 1

    movers.sort(key=lambda x: x["units_out"], reverse=True)
    restock.sort(key=lambda x: (x["status"] != "out", -x["gap"]))
    category_list = sorted(categories.values(), key=lambda x: x["value"], reverse=True)
    return jsonify({
        "period_days": 30,
        "generated_at": now.isoformat() + "Z",
        "health_score": health,
        "tracked_products": len(products),
        "healthy_products": healthy,
        "attention_products": len(low) + len(out),
        "low_stock_products": len(low),
        "out_of_stock_products": len(out),
        "inbound_units": inbound_units,
        "outbound_units": outbound_units,
        "movement_count": len(movements),
        "active_products": len(outbound),
        "restock_gap_units": sum(item["gap"] for item in restock),
        "top_movers": movers[:5],
        "restock_queue": restock[:8],
        "categories": category_list
    })

@app.get("/api/dashboard")
def dashboard():
    seed_if_empty()
    products=Product.query.all()
    return jsonify({
      "product_count":len(products),
      "total_units":sum(p.quantity for p in products),
      "low_stock_count":sum(1 for p in products if 0<p.quantity<=p.min_stock),
      "out_of_stock_count":sum(1 for p in products if p.quantity==0),
      "stock_value":float(sum((p.unit_cost or Decimal("0"))*p.quantity for p in products))
    })

@app.post("/api/demo/reset")
def reset_demo():
    if os.getenv("DEMO_MODE","false").lower()!="true":
        return error("Demo reset is disabled.",403)
    try:
        Movement.query.delete();Product.query.delete();db.session.commit();seed_if_empty()
        return jsonify({"message":"Demonstration data restored."})
    except Exception:
        db.session.rollback();return error("Could not reset demo data.",500)

with app.app_context():
    db.create_all()
    seed_if_empty()

if __name__=="__main__":
    app.run(host="0.0.0.0",port=int(os.getenv("PORT",5000)),debug=False)
