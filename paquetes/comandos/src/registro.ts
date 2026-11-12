import { parecido } from './parecido';
import type { Alcance, Argumento, Comando, Mensaje, Nivel, Origen, Salida, Texto, Valor, Variable } from './tipos';
import { describirTipo, escribirValor, leerValor, mismoValor, palabrasQueUsa, partir, separarLineas } from './valores';

const NOMBRE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

interface Guardada<M> {
  decl: Variable<M>;
  valor: Valor;
}

/** Un cambio del mundo, listo para aplicar en el paso que le toque. */
export type Programador<M> = (linea: string, aplicar: (mundo: M) => void) => void;

/**
 * EL REGISTRO (decisión 0010): las variables y los comandos que declaró cada parte, y el
 * intérprete que ejecuta una línea. No es un lenguaje: una línea es un comando con sus
 * argumentos (o varias, separadas por `;`). Sin variables propias, sin condiciones, sin bucles.
 *
 * Cómo se aplica cada cambio depende de su alcance (ver `Alcance`):
 * - `arranque`: se anota, y al terminar la línea avisa a `alCambiarArranque` (quien monta el
 *   juego lo reinicia). Antes de que haya un mundo, solo se anota: el mundo nace con ese valor.
 * - `mundo`: se anota, y se le pasa al `programador` (lo pone la partida), que lo aplica al
 *   empezar el paso siguiente y lo guarda en su historia. Sin partida todavía, solo se anota, y
 *   la partida lo aplica al crear el mundo (`aplicarAlMundo`).
 * - `vista`: se anota y se aplica enseguida (`alCambiar`).
 *
 * `M` es el tipo del mundo (el núcleo usa `Registro<Mundo>`); este paquete no lo conoce.
 */
export class Registro<M = unknown> {
  private readonly variables = new Map<string, Guardada<M>>();
  private readonly comandos = new Map<string, Comando<M>>();
  private readonly alias = new Map<string, string>();
  /** Lo pone la partida: cómo programar un cambio del mundo para el paso siguiente. */
  programador: Programador<M> | null = null;
  /** Lo pone quien monta el juego: qué hacer cuando cambia algo de arranque (reiniciar). */
  alCambiarArranque: (() => void) | null = null;
  /** En qué idioma se escriben las descripciones (los nombres no cambian nunca). */
  idioma: keyof Texto = 'es';

  // ---------------------------------------------------------------- declarar

  declararVariable(v: Variable<M>) {
    this.comprobarNombre(v.nombre);
    const leido = this.validar(v.tipo, v.porDefecto);
    if (!leido) throw new Error(`${v.nombre}: el valor por defecto no es ${describirTipo(v.tipo)}`);
    this.variables.set(v.nombre, { decl: v, valor: copiar(v.porDefecto) });
  }

  declararComando(c: Comando<M>) {
    this.comprobarNombre(c.nombre);
    const args = c.argumentos ?? [];
    args.forEach((a, i) => {
      if (a.tipo.tipo === 'resto' && i !== args.length - 1)
        throw new Error(`${c.nombre}: un argumento "resto" solo puede ir al final`);
    });
    this.comandos.set(c.nombre, c);
  }

  /** Otro nombre para lo mismo (por ejemplo, en inglés). Las recetas siempre se escriben con el original. */
  declararAlias(alias: string, original: string) {
    this.comprobarNombre(alias);
    if (!this.variables.has(original) && !this.comandos.has(original))
      throw new Error(`alias de algo que no existe: ${original}`);
    this.alias.set(alias, original);
  }

  private comprobarNombre(nombre: string) {
    if (!NOMBRE.test(nombre)) throw new Error(`nombre no válido: "${nombre}" (minúsculas, números, "_" y puntos)`);
    if (this.variables.has(nombre) || this.comandos.has(nombre) || this.alias.has(nombre))
      throw new Error(`ya está declarado: ${nombre}`);
  }

  private validar(t: Variable<M>['tipo'], v: Valor): boolean {
    const r = leerValor(
      t,
      partir(escribirValor(v)).map((p) => p.texto),
    );
    return r.ok;
  }

  // ---------------------------------------------------------------- leer

  /** El valor actual de una variable. Pedir una que no existe es un error de programación. */
  valor(nombre: string): Valor {
    const g = this.variables.get(nombre);
    if (!g) throw new Error(`no existe la variable ${nombre}`);
    return copiar(g.valor);
  }

  /** Todas las variables, en el orden en que se declararon, con su valor actual. */
  listaDeVariables(): { decl: Variable<M>; valor: Valor }[] {
    return [...this.variables.values()].map((g) => ({ decl: g.decl, valor: copiar(g.valor) }));
  }

  listaDeComandos(): Comando<M>[] {
    return [...this.comandos.values()];
  }

  /** Las que no tienen su valor por defecto. */
  cambiadas(): { decl: Variable<M>; valor: Valor }[] {
    return this.listaDeVariables().filter((v) => !mismoValor(v.valor, v.decl.porDefecto));
  }

  /** El texto de la descripción, en el idioma elegido (o en castellano, si no está traducida). */
  texto(t: Texto): string {
    return t[this.idioma] ?? t.es;
  }

  /**
   * La receta de lo que se cambió (decisión 0010): lo de arranque y lo del mundo con sus valores
   * finales, y lo de la vista en una sección aparte. Una receta es un AJUSTE, no una historia:
   * los comandos que se ejecutaron no van.
   */
  receta(titulo?: string): string {
    const cambiadas = this.cambiadas();
    const linea = (v: { decl: Variable<M>; valor: Valor }) => `${v.decl.nombre} ${escribirValor(v.valor)}`;
    const delMundo = cambiadas.filter((v) => v.decl.alcance !== 'vista').map(linea);
    const deLaVista = cambiadas.filter((v) => v.decl.alcance === 'vista').map(linea);
    const partes: string[] = [];
    if (titulo) partes.push(`# ${titulo}`);
    partes.push(...delMundo);
    if (deLaVista.length) partes.push('', '# Lo que se ve', ...deLaVista);
    return partes.join('\n') + '\n';
  }

  // ---------------------------------------------------------------- cambiar

  /** Todo a su valor por defecto (lo de la vista se aplica enseguida; lo demás, al reiniciar). */
  restablecer() {
    for (const g of this.variables.values()) {
      if (mismoValor(g.valor, g.decl.porDefecto)) continue;
      g.valor = copiar(g.decl.porDefecto);
      if (g.decl.alcance === 'vista') g.decl.alCambiar?.(copiar(g.valor));
    }
  }

  /** Lo del mundo que no está en su valor por defecto, aplicado a un mundo recién creado. */
  aplicarAlMundo(mundo: M) {
    for (const g of this.variables.values())
      if (g.decl.alcance === 'mundo' && !mismoValor(g.valor, g.decl.porDefecto)) g.decl.alMundo?.(mundo, copiar(g.valor));
  }

  /**
   * Ejecuta un texto: una o varias líneas (separadas por renglón o por `;`), con comentarios
   * (`#`). Devuelve lo que habría que mostrar. Si algo de arranque cambió, avisa una sola vez al
   * final, aunque haya cambiado en varias líneas.
   */
  ejecutar(texto: string, origen: Origen = 'consola'): Mensaje[] {
    const mensajes: Mensaje[] = [];
    const salida: Salida = { escribir: (t, nivel: Nivel = 'info') => mensajes.push({ nivel, texto: t }) };
    let reiniciar = false;
    for (const linea of separarLineas(texto)) if (this.ejecutarLinea(linea, origen, salida)) reiniciar = true;
    if (reiniciar) this.alCambiarArranque?.();
    return mensajes;
  }

  /** Una línea. Devuelve si cambió algo de arranque. */
  private ejecutarLinea(linea: string, origen: Origen, salida: Salida): boolean {
    const palabras = partir(linea);
    const primera = palabras[0];
    if (!primera) return false;
    const nombre = this.alias.get(primera.texto.toLowerCase()) ?? primera.texto.toLowerCase();
    const resto = palabras.slice(1);

    const variable = this.variables.get(nombre);
    if (variable) {
      if (resto.length === 0) {
        salida.escribir(this.describirVariable(variable));
        return false;
      }
      const leido = leerValor(
        variable.decl.tipo,
        resto.map((p) => p.texto),
      );
      if (!leido.ok) {
        salida.escribir(`${nombre}: ${leido.error}`, 'error');
        return false;
      }
      const usadas = palabrasQueUsa(variable.decl.tipo);
      if (resto.length > usadas) {
        salida.escribir(`${nombre}: sobra "${resto[usadas]!.texto}"`, 'error');
        return false;
      }
      return this.fijar(variable, leido.valor, salida);
    }

    const comando = this.comandos.get(nombre);
    if (comando) {
      if (origen === 'receta' && !comando.enRecetas) {
        salida.escribir(`"${nombre}" no se puede usar en una receta: solo desde la consola`, 'error');
        return false;
      }
      const args = this.leerArgumentos(comando, linea, resto, salida);
      if (!args) return false;
      if (comando.alMundo) {
        const alMundo = comando.alMundo;
        const lineaCanonica = [nombre, ...args.map(escribirValor)].join(' ');
        if (this.programador) this.programador(lineaCanonica, (mundo) => alMundo(mundo, args));
        else salida.escribir(`${nombre}: todavía no hay un mundo donde hacerlo`, 'error');
        return false;
      }
      comando.ejecutar?.(args, salida);
      return false;
    }

    const sugerencia = parecido(nombre, this.nombres());
    salida.escribir(
      sugerencia
        ? `no existe "${nombre}". ¿Quisiste decir "${sugerencia}"?`
        : `no existe "${nombre}". Probá "buscar ${nombre}" o "ayuda".`,
      'error',
    );
    return false;
  }

  private fijar(g: Guardada<M>, valor: Valor, salida: Salida): boolean {
    const nombre = g.decl.nombre;
    const cambio = !mismoValor(g.valor, valor);
    g.valor = copiar(valor);
    const escrito = escribirValor(valor);
    switch (g.decl.alcance) {
      case 'arranque':
        salida.escribir(`${nombre} = ${escrito}${cambio && this.alCambiarArranque ? ' (el mundo vuelve a empezar)' : ''}`);
        return cambio;
      case 'mundo': {
        const alMundo = g.decl.alMundo;
        if (this.programador && alMundo) this.programador(`${nombre} ${escrito}`, (mundo) => alMundo(mundo, copiar(valor)));
        salida.escribir(`${nombre} = ${escrito}${this.programador ? ' (desde el paso siguiente)' : ''}`);
        return false;
      }
      case 'vista':
        g.decl.alCambiar?.(copiar(valor));
        salida.escribir(`${nombre} = ${escrito}`);
        return false;
    }
  }

  private leerArgumentos(c: Comando<M>, linea: string, resto: ReturnType<typeof partir>, salida: Salida): Valor[] | null {
    const args: Valor[] = [];
    let i = 0;
    for (const a of c.argumentos ?? []) {
      if (i >= resto.length) {
        if (a.opcional) break;
        salida.escribir(`${c.nombre}: falta ${a.nombre} (${describirTipo(a.tipo)}). Se usa así: ${this.uso(c)}`, 'error');
        return null;
      }
      if (a.tipo.tipo === 'resto') {
        args.push(linea.slice(resto[i]!.inicio).trim());
        i = resto.length;
        break;
      }
      const usadas = palabrasQueUsa(a.tipo);
      const leido = leerValor(
        a.tipo,
        resto.slice(i, i + usadas).map((p) => p.texto),
      );
      if (!leido.ok) {
        salida.escribir(`${c.nombre}: ${a.nombre}: ${leido.error}`, 'error');
        return null;
      }
      args.push(leido.valor);
      i += usadas;
    }
    if (i < resto.length) {
      salida.escribir(`${c.nombre}: sobra "${resto[i]!.texto}". Se usa así: ${this.uso(c)}`, 'error');
      return null;
    }
    return args;
  }

  // ---------------------------------------------------------------- ayuda y autocompletado

  /** Todos los nombres que se pueden escribir (sin los alias). */
  nombres(): string[] {
    return [...this.variables.keys(), ...this.comandos.keys()].sort();
  }

  uso(c: Comando<M>): string {
    const args = (c.argumentos ?? []).map((a: Argumento) => (a.opcional ? `[${a.nombre}]` : a.nombre));
    return [c.nombre, ...args].join(' ');
  }

  describirVariable(g: { decl: Variable<M>; valor: Valor }): string {
    const { decl } = g;
    const alcances: Record<Alcance, string> = {
      arranque: 'de arranque: cambiarla reinicia el mundo',
      mundo: 'del mundo: entra en el paso siguiente',
      vista: 'de la vista',
    };
    return [
      `${decl.nombre} = ${escribirValor(g.valor)}   (por defecto ${escribirValor(decl.porDefecto)} · ${describirTipo(decl.tipo)} · ${alcances[decl.alcance]})`,
      `  ${this.texto(decl.descripcion)}`,
    ].join('\n');
  }

  /** La ayuda de un nombre (variable o comando), o null si no existe. */
  ayudaDe(nombre: string): string | null {
    const original = this.alias.get(nombre) ?? nombre;
    const v = this.variables.get(original);
    if (v) return this.describirVariable(v);
    const c = this.comandos.get(original);
    if (c) return `${this.uso(c)}\n  ${this.texto(c.descripcion)}`;
    return null;
  }

  /**
   * Autocompletar (la tecla Tab): el nombre, o el valor si el nombre ya está escrito y su tipo
   * tiene opciones (si/no, una lista). Devuelve los candidatos y la línea completada hasta donde
   * todos coinciden.
   */
  completar(linea: string): { candidatos: string[]; linea: string } {
    const palabras = partir(linea);
    const terminaEnEspacio = /\s$/.test(linea);
    if (palabras.length === 0 || (palabras.length === 1 && !terminaEnEspacio)) {
      const parcial = (palabras[0]?.texto ?? '').toLowerCase();
      const candidatos = [...this.nombres(), ...this.alias.keys()].filter((n) => n.startsWith(parcial)).sort();
      return { candidatos, linea: completarHasta(parcial, candidatos, '') };
    }
    const nombre = this.alias.get(palabras[0]!.texto.toLowerCase()) ?? palabras[0]!.texto.toLowerCase();
    const tipo = this.variables.get(nombre)?.decl.tipo ?? this.comandos.get(nombre)?.argumentos?.[0]?.tipo;
    const opciones =
      tipo?.tipo === 'booleano'
        ? ['si', 'no']
        : tipo?.tipo === 'opcion'
          ? [...tipo.opciones]
          : nombre === 'ayuda' || nombre === 'alternar'
            ? this.nombres()
            : [];
    const parcial = terminaEnEspacio ? '' : (palabras[palabras.length - 1]?.texto ?? '').toLowerCase();
    if (palabras.length > (terminaEnEspacio ? 1 : 2)) return { candidatos: [], linea };
    const candidatos = opciones.filter((o) => o.startsWith(parcial));
    const antes = `${palabras[0]!.texto} `;
    return { candidatos, linea: completarHasta(parcial, candidatos, antes) };
  }
}

/** Lo más largo que tienen en común todos los candidatos (y un espacio, si hay uno solo). */
function completarHasta(parcial: string, candidatos: string[], antes: string): string {
  if (candidatos.length === 0) return antes + parcial;
  if (candidatos.length === 1) return `${antes}${candidatos[0]} `;
  let comun = candidatos[0]!;
  for (const c of candidatos) while (!c.startsWith(comun)) comun = comun.slice(0, -1);
  return antes + (comun.length > parcial.length ? comun : parcial);
}

function copiar(v: Valor): Valor {
  return Array.isArray(v) ? [v[0], v[1], v[2]] : v;
}
