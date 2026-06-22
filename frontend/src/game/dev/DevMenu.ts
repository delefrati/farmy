// Dev-only overlay menu for fast testing/validation. Rendered as a plain DOM
// panel layered over the Phaser canvas (rich form controls are far easier in
// HTML than in-canvas text). Gated behind import.meta.env.DEV by the caller.
//
// The scene builds a config of value fields and one-shot actions bound to its
// live state, then calls mountDevMenu(). Editing a field or running an action
// invokes config.onChange() (which the scene wires to save + restart), so the
// panel always re-reads fresh values after a change.

export interface DevMenuField {
  label: string;
  get: () => number;
  set: (value: number) => void;
}

export interface DevMenuAction {
  label: string;
  run: () => void;
  // When false, the menu's onChange (save + restart) is NOT invoked after the
  // action — the action persists/restarts on its own. Defaults to true.
  apply?: boolean;
}

export interface DevMenuSection {
  title: string;
  fields?: DevMenuField[];
  actions?: DevMenuAction[];
}

export interface DevMenuConfig {
  sections: DevMenuSection[];
  // Called after any value edit or applying action to persist + reflect it.
  onChange: () => void;
}

const PANEL_ID = 'farmy-dev-menu';
const OPEN_KEY = 'farmy.dev.menuOpen';

let keyHandler: ((event: KeyboardEvent) => void) | null = null;

const isOpen = (): boolean => localStorage.getItem(OPEN_KEY) === '1';
const setOpen = (open: boolean): void => localStorage.setItem(OPEN_KEY, open ? '1' : '0');

export const unmountDevMenu = (): void => {
  document.getElementById(PANEL_ID)?.remove();
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
};

export const mountDevMenu = (config: DevMenuConfig): void => {
  // Scene restarts re-mount with fresh closures; drop the previous instance.
  unmountDevMenu();

  const root = document.createElement('div');
  root.id = PANEL_ID;
  Object.assign(root.style, {
    position: 'fixed',
    top: '8px',
    right: '8px',
    zIndex: '99999',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '12px',
    color: '#f4f4f4',
    pointerEvents: 'auto',
  } satisfies Partial<CSSStyleDeclaration>);

  const tab = document.createElement('button');
  Object.assign(tab.style, {
    display: 'block',
    marginLeft: 'auto',
    padding: '4px 10px',
    background: '#7a3b00',
    color: '#fff',
    border: '1px solid #ffb066',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>);

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    marginTop: '6px',
    width: '250px',
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: '8px 10px 12px',
    background: 'rgba(24, 24, 28, 0.94)',
    border: '1px solid #555',
    borderRadius: '8px',
    boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
  } satisfies Partial<CSSStyleDeclaration>);

  // Stop key events inside the panel from reaching Phaser's window-level
  // keyboard handlers (typing "1" in a field must not trigger a game hotkey).
  panel.addEventListener('keydown', (event) => event.stopPropagation());
  panel.addEventListener('keyup', (event) => event.stopPropagation());

  const render = (): void => {
    panel.style.display = isOpen() ? 'block' : 'none';
    tab.textContent = isOpen() ? 'DEV \u25BE' : 'DEV \u25B8';
  };

  const hint = document.createElement('div');
  hint.textContent = 'Toggle with ` (backtick)';
  Object.assign(hint.style, {
    color: '#999',
    marginBottom: '8px',
    fontSize: '11px',
  } satisfies Partial<CSSStyleDeclaration>);
  panel.appendChild(hint);

  for (const section of config.sections) {
    const heading = document.createElement('div');
    heading.textContent = section.title;
    Object.assign(heading.style, {
      margin: '10px 0 4px',
      paddingBottom: '2px',
      borderBottom: '1px solid #444',
      color: '#ffb066',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      fontSize: '11px',
    } satisfies Partial<CSSStyleDeclaration>);
    panel.appendChild(heading);

    for (const field of section.fields ?? []) {
      const row = document.createElement('label');
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        margin: '3px 0',
      } satisfies Partial<CSSStyleDeclaration>);

      const name = document.createElement('span');
      name.textContent = field.label;
      name.style.flex = '1';

      const input = document.createElement('input');
      input.type = 'number';
      input.value = String(field.get());
      Object.assign(input.style, {
        width: '78px',
        padding: '2px 4px',
        background: '#111',
        color: '#fff',
        border: '1px solid #666',
        borderRadius: '4px',
        textAlign: 'right',
      } satisfies Partial<CSSStyleDeclaration>);

      const commit = (): void => {
        const value = Number(input.value);
        if (Number.isFinite(value)) {
          field.set(value);
          config.onChange();
        }
      };
      input.addEventListener('change', commit);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          commit();
        }
      });

      row.appendChild(name);
      row.appendChild(input);
      panel.appendChild(row);
    }

    const actions = section.actions ?? [];
    if (actions.length > 0) {
      const grid = document.createElement('div');
      Object.assign(grid.style, {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        margin: '4px 0',
      } satisfies Partial<CSSStyleDeclaration>);

      for (const action of actions) {
        const button = document.createElement('button');
        button.textContent = action.label;
        Object.assign(button.style, {
          flex: '1 1 auto',
          padding: '4px 6px',
          background: '#2f5f3f',
          color: '#fff',
          border: '1px solid #5fae7f',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '11px',
        } satisfies Partial<CSSStyleDeclaration>);
        button.addEventListener('click', () => {
          action.run();
          if (action.apply !== false) {
            config.onChange();
          }
        });
        grid.appendChild(button);
      }
      panel.appendChild(grid);
    }
  }

  tab.addEventListener('click', () => {
    setOpen(!isOpen());
    render();
  });

  keyHandler = (event: KeyboardEvent): void => {
    if (event.key === '`' || event.key === '~') {
      setOpen(!isOpen());
      render();
    }
  };
  window.addEventListener('keydown', keyHandler);

  root.appendChild(tab);
  root.appendChild(panel);
  document.body.appendChild(root);
  render();
};
