"""
====================================================================
SISTEMA DE GESTIÓN DE ALMACÉN E INVENTARIO GENERAL (SUMINISTROS INTERNOS)
Servidor Principal Backend REST API & Servidor de Archivos Estáticos
Desarrollado en Python con Flask y SQLite3
====================================================================
"""

import os
import sys
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from dotenv import load_dotenv

# Forzar codificación UTF-8 en salida de consola de Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Cargar variables de entorno desde .env
load_dotenv()

PORT = int(os.getenv("PORT", 5000))
DB_PATH = os.getenv("DB_PATH", "./database/almacen.sqlite")
LOW_STOCK_THRESHOLD = int(os.getenv("LOW_STOCK_THRESHOLD", 10))

# Asegurar que el directorio de la base de datos exista
db_dir = os.path.dirname(os.path.abspath(DB_PATH))
if not os.path.exists(db_dir):
    os.makedirs(db_dir, exist_ok=True)

app = Flask(__name__, static_folder="public", static_url_path="")
CORS(app)

def get_db_connection():
    """Establece conexión a la base de datos SQLite con claves foráneas activadas."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    """Inicializa la base de datos ejecutando schema.sql y seed.sql si es necesario."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Ejecutar Schema
        schema_path = os.path.abspath("schema.sql")
        if os.path.exists(schema_path):
            with open(schema_path, "r", encoding="utf-8") as f:
                cursor.executescript(f.read())
        
        # Verificar si existen categorías; si no, ejecutar Seed
        cursor.execute("SELECT COUNT(*) as count FROM categorias")
        row = cursor.fetchone()
        if row["count"] == 0:
            seed_path = os.path.abspath("seed.sql")
            if os.path.exists(seed_path):
                print("[SEED] Cargando datos de prueba iniciales...")
                with open(seed_path, "r", encoding="utf-8") as f:
                    cursor.executescript(f.read())
                print("[SEED] Datos iniciales cargados exitosamente.")
                
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[ERROR] Error al inicializar la base de datos: {e}")

# ====================================================================
# RUTAS DE LA API RESTful
# ====================================================================

# --------------------------------------------------------------------
# 1. DASHBOARD (/api/dashboard/stats)
# --------------------------------------------------------------------
@app.route("/api/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Total Artículos distintos
        cursor.execute("SELECT COUNT(*) as count FROM articulos")
        total_articulos = cursor.fetchone()["count"]

        # Total Unidades en Stock
        cursor.execute("SELECT COALESCE(SUM(cantidad_disponible), 0) as total FROM articulos")
        total_unidades = cursor.fetchone()["total"]

        # Total Categorías
        cursor.execute("SELECT COUNT(*) as count FROM categorias")
        total_categorias = cursor.fetchone()["count"]

        # Stock Bajo (>0 y <= threshold)
        cursor.execute("SELECT COUNT(*) as count FROM articulos WHERE cantidad_disponible > 0 AND cantidad_disponible <= ?", (LOW_STOCK_THRESHOLD,))
        stock_bajo_count = cursor.fetchone()["count"]

        # Agotados (=0)
        cursor.execute("SELECT COUNT(*) as count FROM articulos WHERE cantidad_disponible = 0")
        agotados_count = cursor.fetchone()["count"]

        # Ítems prioritarios para alerta
        cursor.execute("""
            SELECT a.id, a.nombre, a.sku, a.cantidad_disponible, c.nombre as categoria_nombre,
                   CASE WHEN a.cantidad_disponible = 0 THEN 'Agotado' ELSE 'Stock Bajo' END as estado_alerta
            FROM articulos a
            JOIN categorias c ON a.categoria_id = c.id
            WHERE a.cantidad_disponible <= ?
            ORDER BY a.cantidad_disponible ASC
            LIMIT 10
        """, (LOW_STOCK_THRESHOLD,))
        alert_items = [dict(r) for r in cursor.fetchall()]

        # Distribución por categoría
        cursor.execute("""
            SELECT c.nombre as categoria, COUNT(a.id) as total_articulos, COALESCE(SUM(a.cantidad_disponible), 0) as total_unidades
            FROM categorias c
            LEFT JOIN articulos a ON c.id = a.categoria_id
            GROUP BY c.id
            ORDER BY total_unidades DESC
        """)
        distribucion = [dict(r) for r in cursor.fetchall()]

        conn.close()

        return jsonify({
            "success": True,
            "data": {
                "totalArticulos": total_articulos,
                "totalUnidadesStock": total_unidades,
                "totalCategorias": total_categorias,
                "stockBajoCount": stock_bajo_count,
                "agotadosCount": agotados_count,
                "alertCountTotal": stock_bajo_count + agotados_count,
                "lowStockThreshold": LOW_STOCK_THRESHOLD,
                "alertItems": alert_items,
                "distribucionCategorias": distribucion
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# --------------------------------------------------------------------
# 2. ARTÍCULOS (/api/articulos)
# --------------------------------------------------------------------
@app.route("/api/articulos", methods=["GET"])
def get_articulos():
    try:
        search = request.args.get("search", "").strip()
        categoria_id = request.args.get("categoria_id", "")
        page = max(1, int(request.args.get("page", 1)))
        limit = max(1, min(100, int(request.args.get("limit", 10))))
        sort_by = request.args.get("sortBy", "id")
        order = request.args.get("order", "DESC").upper()
        offset = (page - 1) * limit

        conn = get_db_connection()
        cursor = conn.cursor()

        where_clauses = []
        params = []

        if search:
            pattern = f"%{search}%"
            where_clauses.append("(a.nombre LIKE ? OR a.sku LIKE ? OR a.descripcion LIKE ?)")
            params.extend([pattern, pattern, pattern])

        if categoria_id and categoria_id.isdigit() and int(categoria_id) > 0:
            where_clauses.append("a.categoria_id = ?")
            params.append(int(categoria_id))

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        valid_sorts = {
            "id": "a.id",
            "nombre": "a.nombre",
            "sku": "a.sku",
            "cantidad_disponible": "a.cantidad_disponible",
            "categoria": "c.nombre",
            "ultima_actualizacion": "a.ultima_actualizacion"
        }
        sort_col = valid_sorts.get(sort_by, "a.id")
        sort_ord = "ASC" if order == "ASC" else "DESC"

        # Conteo Total
        cursor.execute(f"SELECT COUNT(*) as total FROM articulos a {where_sql}", params)
        total_items = cursor.fetchone()["total"]
        total_pages = (total_items + limit - 1) // limit if total_items > 0 else 1

        # Datos Paginados
        query = f"""
            SELECT a.id, a.nombre, a.descripcion, a.sku, a.cantidad_disponible, 
                   a.categoria_id, c.nombre as categoria_nombre, a.fecha_ingreso, a.ultima_actualizacion
            FROM articulos a
            JOIN categorias c ON a.categoria_id = c.id
            {where_sql}
            ORDER BY {sort_col} {sort_ord}
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [limit, offset])
        articles = [dict(r) for r in cursor.fetchall()]
        conn.close()

        return jsonify({
            "success": True,
            "data": articles,
            "pagination": {
                "totalItems": total_items,
                "totalPages": total_pages,
                "currentPage": page,
                "limit": limit
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/articulos/export/csv", methods=["GET"])
def export_articulos_csv():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.id, a.sku, a.nombre, a.descripcion, c.nombre as categoria, 
                   a.cantidad_disponible, a.fecha_ingreso, a.ultima_actualizacion
            FROM articulos a
            JOIN categorias c ON a.categoria_id = c.id
            ORDER BY a.nombre ASC
        """)
        rows = cursor.fetchall()
        conn.close()

        csv_lines = ["ID,SKU,Nombre,Descripción,Categoría,Cantidad Disponible,Fecha Ingreso,Última Actualización"]
        for r in rows:
            desc_sanitized = f'"{ (r["descripcion"] or "").replace("#", "").replace(chr(34), chr(34)+chr(34)) }"'
            nombre_sanitized = f'"{ (r["nombre"] or "").replace(chr(34), chr(34)+chr(34)) }"'
            cat_sanitized = f'"{ (r["categoria"] or "").replace(chr(34), chr(34)+chr(34)) }"'
            csv_lines.append(f'{r["id"]},{r["sku"]},{nombre_sanitized},{desc_sanitized},{cat_sanitized},{r["cantidad_disponible"]},"{r["fecha_ingreso"]}","{r["ultima_actualizacion"]}"')

        csv_output = "\ufeff" + "\n".join(csv_lines)
        return Response(csv_output, mimetype="text/csv", headers={
            "Content-Disposition": f"attachment; filename=inventario_almacen_{int(datetime.now().timestamp())}.csv"
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/articulos/<int:art_id>", methods=["GET"])
def get_articulo_by_id(art_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.id, a.nombre, a.descripcion, a.sku, a.cantidad_disponible, 
                   a.categoria_id, c.nombre as categoria_nombre, a.fecha_ingreso, a.ultima_actualizacion
            FROM articulos a
            JOIN categorias c ON a.categoria_id = c.id
            WHERE a.id = ?
        """, (art_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({"success": False, "message": "Artículo no encontrado"}), 404

        return jsonify({"success": True, "data": dict(row)})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/articulos", methods=["POST"])
def create_articulo():
    try:
        data = request.get_json() or {}
        nombre = str(data.get("nombre", "")).strip()
        sku = str(data.get("sku", "")).strip().upper()
        descripcion = str(data.get("descripcion", "")).strip()
        cantidad = data.get("cantidad_disponible")
        categoria_id = data.get("categoria_id")

        # Validaciones
        errors = []
        if not nombre:
            errors.append("El nombre del artículo es obligatorio.")
        if not sku:
            errors.append("El SKU es obligatorio.")
        if cantidad is None or not isinstance(cantidad, int) or cantidad < 0:
            errors.append("La cantidad disponible debe ser un número entero >= 0.")
        if not categoria_id or not isinstance(categoria_id, int) or categoria_id <= 0:
            errors.append("Debe seleccionar una categoría válida.")

        if errors:
            return jsonify({"success": False, "message": "Error de validación", "errors": errors}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Verificar unicidad SKU
        cursor.execute("SELECT id FROM articulos WHERE sku = ?", (sku,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"success": False, "message": f"El código SKU '{sku}' ya existe en el inventario."}), 400

        cursor.execute("""
            INSERT INTO articulos (nombre, descripcion, sku, cantidad_disponible, categoria_id)
            VALUES (?, ?, ?, ?, ?)
        """, (nombre, descripcion, sku, cantidad, categoria_id))
        conn.commit()
        new_id = cursor.lastrowid

        cursor.execute("""
            SELECT a.*, c.nombre as categoria_nombre FROM articulos a 
            JOIN categorias c ON a.categoria_id = c.id WHERE a.id = ?
        """, (new_id,))
        new_item = dict(cursor.fetchone())
        conn.close()

        return jsonify({"success": True, "message": "Artículo creado con éxito.", "data": new_item}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/articulos/<int:art_id>", methods=["PUT"])
def update_articulo(art_id):
    try:
        data = request.get_json() or {}
        nombre = str(data.get("nombre", "")).strip()
        sku = str(data.get("sku", "")).strip().upper()
        descripcion = str(data.get("descripcion", "")).strip()
        cantidad = data.get("cantidad_disponible")
        categoria_id = data.get("categoria_id")

        errors = []
        if not nombre:
            errors.append("El nombre del artículo es obligatorio.")
        if not sku:
            errors.append("El SKU es obligatorio.")
        if cantidad is None or not isinstance(cantidad, int) or cantidad < 0:
            errors.append("La cantidad disponible debe ser un entero >= 0.")
        if not categoria_id or not isinstance(categoria_id, int):
            errors.append("Categoría inválida.")

        if errors:
            return jsonify({"success": False, "message": "Error de validación", "errors": errors}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Verificar existencia
        cursor.execute("SELECT id FROM articulos WHERE id = ?", (art_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"success": False, "message": "Artículo no encontrado."}), 404

        # Verificar conflicto SKU
        cursor.execute("SELECT id FROM articulos WHERE sku = ? AND id != ?", (sku, art_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({"success": False, "message": f"El código SKU '{sku}' ya está asignado a otro artículo."}), 400

        cursor.execute("""
            UPDATE articulos
            SET nombre = ?, descripcion = ?, sku = ?, cantidad_disponible = ?, categoria_id = ?, ultima_actualizacion = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (nombre, descripcion, sku, cantidad, categoria_id, art_id))
        conn.commit()

        cursor.execute("""
            SELECT a.*, c.nombre as categoria_nombre FROM articulos a 
            JOIN categorias c ON a.categoria_id = c.id WHERE a.id = ?
        """, (art_id,))
        updated_item = dict(cursor.fetchone())
        conn.close()

        return jsonify({"success": True, "message": "Artículo actualizado correctamente.", "data": updated_item})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/articulos/<int:art_id>", methods=["DELETE"])
def delete_articulo(art_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT nombre FROM articulos WHERE id = ?", (art_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({"success": False, "message": "Artículo no encontrado."}), 404

        article_name = row["nombre"]
        cursor.execute("DELETE FROM articulos WHERE id = ?", (art_id,))
        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": f"Artículo '{article_name}' eliminado del almacén."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# --------------------------------------------------------------------
# 3. CATEGORÍAS (/api/categorias)
# --------------------------------------------------------------------
@app.route("/api/categorias", methods=["GET"])
def get_categorias():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.id, c.nombre, c.descripcion, c.fecha_creacion,
                   COUNT(a.id) as total_articulos, COALESCE(SUM(a.cantidad_disponible), 0) as total_unidades
            FROM categorias c
            LEFT JOIN articulos a ON c.id = a.categoria_id
            GROUP BY c.id
            ORDER BY c.nombre ASC
        """)
        cats = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify({"success": True, "data": cats})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/categorias", methods=["POST"])
def create_categoria():
    try:
        data = request.get_json() or {}
        nombre = str(data.get("nombre", "")).strip()
        descripcion = str(data.get("descripcion", "")).strip()

        if not nombre:
            return jsonify({"success": False, "message": "El nombre de la categoría es obligatorio."}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?)", (nombre,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"success": False, "message": f"La categoría '{nombre}' ya existe."}), 400

        cursor.execute("INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)", (nombre, descripcion))
        conn.commit()
        new_id = cursor.lastrowid

        cursor.execute("SELECT * FROM categorias WHERE id = ?", (new_id,))
        new_cat = dict(cursor.fetchone())
        conn.close()

        return jsonify({"success": True, "message": "Categoría creada con éxito.", "data": new_cat}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/categorias/<int:cat_id>", methods=["PUT"])
def update_categoria(cat_id):
    try:
        data = request.get_json() or {}
        nombre = str(data.get("nombre", "")).strip()
        descripcion = str(data.get("descripcion", "")).strip()

        if not nombre:
            return jsonify({"success": False, "message": "El nombre de la categoría es obligatorio."}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?) AND id != ?", (nombre, cat_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({"success": False, "message": f"Ya existe otra categoría con el nombre '{nombre}'."}), 400

        cursor.execute("UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?", (nombre, descripcion, cat_id))
        conn.commit()

        cursor.execute("SELECT * FROM categorias WHERE id = ?", (cat_id,))
        updated_cat = dict(cursor.fetchone())
        conn.close()

        return jsonify({"success": True, "message": "Categoría actualizada correctamente.", "data": updated_cat})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/categorias/<int:cat_id>", methods=["DELETE"])
def delete_categoria(cat_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT nombre FROM categorias WHERE id = ?", (cat_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({"success": False, "message": "Categoría no encontrada."}), 404

        cat_name = row["nombre"]
        cursor.execute("SELECT COUNT(*) as count FROM articulos WHERE categoria_id = ?", (cat_id,))
        art_count = cursor.fetchone()["count"]

        if art_count > 0:
            conn.close()
            return jsonify({
                "success": False, 
                "message": f"No se puede eliminar la categoría '{cat_name}' porque tiene {art_count} artículo(s) asignado(s)."
            }), 400

        cursor.execute("DELETE FROM categorias WHERE id = ?", (cat_id,))
        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": f"Categoría '{cat_name}' eliminada correctamente."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# --------------------------------------------------------------------
# SERVICIO DE ARCHIVOS ESTÁTICOS DE LA SPA
# --------------------------------------------------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    init_db()
    print("=======================================================")
    print("[SERVER] SISTEMA DE GESTION DE ALMACEN E INVENTARIO GENERAL")
    print(f"[SERVER] Servidor Python Flask ejecutandose en: http://localhost:{PORT}")
    print("=======================================================")
    app.run(host="0.0.0.0", port=PORT, debug=True)
