/* eslint-disable no-dupe-class-members */
import { isArray, isUndefined, Shortcuts, EMPTY_OBJ, warn, isString } from '@tarojs/shared'
import { TaroNode } from './node'
import { NodeType } from './node_types'
import { TaroEvent, eventSource } from './event'
import { isElement } from '../utils'
import { Style } from './style'
import { PROPERTY_THRESHOLD } from '../constants'

interface Attributes {
  name: string;
  value: string;
}

export class TaroElement extends TaroNode {
  public props: Record<string, string> = {}

  public dataset: Record<string, unknown> = EMPTY_OBJ

  public tagName: string

  public style: Style

  public constructor (nodeType: NodeType, nodeName: string) {
    super(nodeType || NodeType.ELEMENT_NODE, nodeName)
    this.tagName = nodeName.toUpperCase()
    this.style = new Style(this)
  }

  public get id () {
    return this.getAttribute('id')!
  }

  public set id (val: string) {
    this.setAttribute('id', val)
  }

  public get className () {
    return this.getAttribute('class') || ''
  }

  public set className (val: string) {
    this.setAttribute('class', val)
  }

  public get cssText () {
    return this.getAttribute('style') || ''
  }

  public get children () {
    return this.childNodes.filter(isElement)
  }

  public hasAttribute (qualifiedName: string) {
    return !isUndefined(this.props[qualifiedName])
  }

  public hasAttributes () {
    return this.attributes.length > 0
  }

  public focus () {
    this.setAttribute('focus', true)
  }

  public blur () {
    this.setAttribute('focus', false)
  }

  public setAttribute (qualifiedName: string, value: string | boolean): void {
    warn(
      isString(value) && value.length > PROPERTY_THRESHOLD,
      `元素 ${this.nodeName} 的 属性 ${qualifiedName} 的值数据量过大，可能会影响渲染性能。`
    )

    if (qualifiedName === 'style') {
      this.style.cssText = value as string
      qualifiedName = Shortcuts.Style
    } else if (qualifiedName === 'id') {
      eventSource.delete(this.uid)
      this.uid = value as string
      eventSource.set(value as string, this)
      qualifiedName = 'uid'
    } else {
      this.props[qualifiedName] = value as string
      if (qualifiedName === 'class') {
        qualifiedName = Shortcuts.Class
      }
      if (qualifiedName.startsWith('data-')) {
        if (this.dataset === EMPTY_OBJ) {
          this.dataset = Object.create(null)
        }
        this.dataset[qualifiedName.replace(/^data-/, '')] = value
      }
    }

    this.enqueueUpdate({
      path: `${this._path}.${qualifiedName}`,
      value
    })
  }

  public removeAttribute (qualifiedName: string) {
    if (qualifiedName === 'style') {
      this.style.cssText = ''
    } else {
      delete this.props[qualifiedName]
    }
    this.enqueueUpdate({
      path: `${this._path}.${qualifiedName}`,
      value: ''
    })
  }

  public getAttribute (qualifiedName: string): string | null {
    const attr = qualifiedName === 'style' ? this.style.cssText : this.props[qualifiedName]
    return attr || null
  }

  public get attributes (): Attributes[] {
    const propKeys = Object.keys(this.props)
    const style = this.style.cssText
    const attrs = propKeys.map(p => ({ name: p, value: this.props[p] }))
    return attrs.concat(style ? { name: 'style', value: style } : [])
  }

  public get parentElement () {
    if (this.parentNode instanceof TaroElement) {
      return this.parentNode
    }
    return null
  }

  public dispatchEvent (event: TaroEvent) {
    const cancelable = event.cancelable
    const listeners = this.__handlers[event.type]
    if (!isArray(listeners)) {
      return
    }

    for (let i = listeners.length; i--;) {
      const listener = listeners[i]
      let result: unknown
      if (listener._stop) {
        listener._stop = false
      } else {
        result = listener.call(this, event)
      }
      if ((result === false || event._end) && cancelable) {
        event.defaultPrevented = true
      }
    }

    if (event._stop) {
      this._stopPropagation(event)
    } else {
      event._stop = true
    }

    return listeners != null
  }

  private _stopPropagation (event: TaroEvent) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let target = this
    // eslint-disable-next-line no-cond-assign
    while ((target = target.parentNode as this)) {
      const listeners = target.__handlers[event.type]

      if (!isArray(listeners)) {
        continue
      }

      for (let i = listeners.length; i--;) {
        const l = listeners[i]
        l._stop = true
      }
    }
  }
}