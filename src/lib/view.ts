// Nodeが取りうる型は3種類
type NodeType = VNode | string | number;
// Attribute の型
type AttributeType = string | EventListener;
type Attributes = {
  [attr: string]: AttributeType;
};

export type VNode = {
  nodeName: keyof HTMLElementTagNameMap; // ElementTagNameMap is deprecated
  attributes: Attributes;
  children: NodeType[];
};

const isVNode = (node: NodeType): node is VNode => {
  return typeof node !== 'string' && typeof node !== 'number';
};

const isEventAttr = (attribute: string): boolean => {
  return /^on/.test(attribute); // onから始まるAttribute はevent とする
};

export interface View<State, Action> {
  // state, action を引数にVNode を返す関数（コールシグネチャ）
  (state: State, action: Action): VNode;
}

/**
 * create Virtual DOM
 */
export function h(
  nodeName: VNode['nodeName'],
  attributes: VNode['attributes'],
  ...children: VNode['children']
): VNode {
  return {
    nodeName,
    attributes,
    children,
  };
}

const setAttributes = (target: HTMLElement, attributes: Attributes): void => {
  for (const attr in attributes) {
    if (isEventAttr(attr)) {
      // on を除いたEvent 名を取得
      const eventName = attr.slice(2);
      target.addEventListener(eventName, attributes[attr] as EventListener);
    } else {
      target.setAttribute(attr, attributes[attr] as string);
    }
  }
};

const updateAttributes = (
  target: HTMLElement,
  oldAttrs: Attributes,
  newAttrs: Attributes,
): void => {
  for (const attr in oldAttrs) {
    if (!isEventAttr(attr)) {
      target.removeAttribute(attr);
    }
  }

  for (const attr in newAttrs) {
    if (isEventAttr(attr)) {
      target.setAttribute(attr, newAttrs[attr] as string);
    }
  }
};

const updateValue = (target: HTMLInputElement, newValue: string): void => {
  target.value = newValue;
};

enum ChangedType {
  None, // 差分なし
  Type, // NodeType が異なる
  Text, // テキストNode が異なる
  Node, // 要素名が異なる
  Value, // value属性が異なる(input用)
  Attr, // 属性が異なる
}

const hasChanged = (a: NodeType, b: NodeType): ChangedType => {
  if (typeof a !== typeof b) {
    return ChangedType.Type;
  }

  if (!isVNode(a) && a !== b) {
    return ChangedType.Text;
  }

  if (isVNode(a) && isVNode(b)) {
    if (a.nodeName !== b.nodeName) {
      return ChangedType.Node;
    }

    if (a.attributes.value !== b.attributes.value) {
      return ChangedType.Value;
    }

    if (JSON.stringify(a.attributes) !== JSON.stringify(b.attributes)) {
      return ChangedType.Attr; //本来ならオブジェクトをひとつひとつ比較すべき
    }
  }
  return ChangedType.None;
};

export function createElement(node: NodeType): HTMLElement | Text {
  if (!isVNode(node)) {
    return document.createTextNode(node.toString());
  }

  const el = document.createElement(node.nodeName);
  setAttributes(el, node.attributes);
  node.children.forEach((child) => el.appendChild(createElement(child)));

  return el;
}

export function updateElement(
  parent: HTMLElement,
  oldNode: NodeType,
  newNode: NodeType,
  index = 0,
): void {
  if (!oldNode) {
    parent.appendChild(createElement(newNode));
    return;
  }

  const target = parent.childNodes[index];
  if (!newNode) {
    parent.removeChild(target);
    return;
  }

  const changeType = hasChanged(oldNode, newNode);
  switch (changeType) {
    case ChangedType.Type:
    case ChangedType.Text:
    case ChangedType.Node:
      parent.replaceChild(createElement(newNode), target);
      return;

    case ChangedType.Value:
      updateValue(
        target as HTMLInputElement,
        (newNode as VNode).attributes.value as string,
      );
      return;

    case ChangedType.Attr:
      updateAttributes(
        target as HTMLElement,
        (oldNode as VNode).attributes,
        (newNode as VNode).attributes,
      );
      return;
  }

  if (isVNode(oldNode) && isVNode(newNode)) {
    for (
      let i = 0;
      i < newNode.children.length || i < oldNode.children.length;
      i++
    ) {
      updateElement(
        target as HTMLElement,
        oldNode.children[i],
        newNode.children[i],
      );
    }
  }
}
