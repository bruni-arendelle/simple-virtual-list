const { min, max, ceil, floor } = Math;

const clamp = (
  value: number,
  minValue: number,
  maxValue: number
): number => min(maxValue, max(minValue, value));

type VirtualListOption = {
  /** 所在容器 */
  container: HTMLElement,
  /** 列表项数量 */
  itemCount: number,
  /** 元素高度 */
  itemHeight: number,
  /** 列表项渲染器 */
  itemRenderer: (i: number) => HTMLElement,
  /** 超出显示范围的渲染数量 */
  overscan?: number,
}

export class VirtualList {
  /** 所在容器 */
  _container: HTMLElement

  /** 列表元素 */
  _listEl: HTMLElement|undefined

  /** 列表项数量 */
  _itemCount: number

  /** 列表项高度 */
  _itemHeight: number

  /** 超出显示范围的渲染数量 */
  _overscan: number

  /** 列表项渲染器 */
  _renderItem: (i: number) => HTMLElement
  
  /** 已渲染列表项映射 */
  _items: Map<number, HTMLElement> = new Map()

  /** 滚动监测 */
  _scroller: {_dispose: () => void}|null = null

  /** 渲染范围 */
  _range: [number, number] = [0, 0]

  constructor(options: VirtualListOption) {
    this._container = options.container

    this._itemCount = options.itemCount
    this._itemHeight = options.itemHeight
    this._renderItem = (i: number) => {
      const item = options.itemRenderer(i)
      item.style.height = options.itemHeight + 'px'
      return item
    }

    this._overscan = options.overscan || this.itemCountPerView

    this._listEl = this._createListEl()
    this._container.appendChild(this._listEl)

    this._renderList()
    this._scroller = this._observeScroll()
  }

  /** 滚动区高度 */
  get viewportHeight() {
    return this._container.getBoundingClientRect().height
  }

  /** 每屏渲染列表项数量 */
  get itemCountPerView() {
    return max(ceil(this.viewportHeight/this._itemHeight), 3)
  }

  /** 列表高度 */
  get listHeight() {
    return this._itemHeight * this._itemCount
  }

  /** 渲染项顶部偏移 */
  get offset() {
    return this._itemHeight * this._range[0]
  }

  /** 生成列表 */
  _createListEl() {
    const list = document.createElement('div')
    list.classList.add('virtual-list')
    list.style.height = this.listHeight + 'px'
    list.style.paddingTop = this.offset + 'px'
    return list
  }

  /** 获取渲染范围 */
  _getRange() {
    const index = floor(this._container.scrollTop/this._itemHeight)
    const start = clamp(index - this._overscan, 0, this._itemCount - 1)
    const end = clamp(index + this.itemCountPerView - 1 + this._overscan, 0, this._itemCount - 1)
    return [start, end]
  }

  /** 主动滚动时计算偏移量 */
  _calcOffset(start: number, end: number) {
    const viewHeight = this.viewportHeight
    const index = (start + end) / 2
    const height = this._itemHeight
    return height * index + (height - viewHeight)/2
  }

  /** 在指定范围内插入选项 */
  _insert(start: number, end: number) {
    const items: HTMLElement[] = []
    for (let i = start; i <= end; i++) {
      const item = this._renderItem(i)
      items.push(item)
      this._items.set(i, item)
    }
    if (end <= this._range[0]) {
      this._listEl!.prepend(...items)
    } else {
      this._listEl!.append(...items)
    }
  }

  /** 移除指定范围内的选项 */
  _remove(start: number, end: number) {
    for (let i = start; i <= end; i++) {
      const item = this._items.get(i)
      if (item) {
        this._items.delete(i)
        this._listEl!.removeChild(item)
      }
    }
  }

  /** 渲染列表 */
  _renderList() {
    const [start, end] = this._getRange()
    // console.log('_renderList', {start, end})
    const [currentStart, currentEnd] = this._range

    // 完全没有交集
    if (start > currentEnd || end < currentStart) {
      this._remove(currentStart, currentEnd)
    }

    if (this._items.size === 0) {
      this._insert(start, end)
      this._range = [start, end]
      this._listEl!.style.paddingTop = this.offset + 'px'
      return
    }

    if (start > currentStart) {
      this._remove(currentStart, start - 1)
    } else if (start < currentStart) {
      this._insert(start, currentStart - 1)
    }

    if (end < currentEnd) {
      this._remove(end + 1, currentEnd)
    } else if (end > currentEnd) {
      this._insert(currentEnd + 1, end)
    }

    this._range = [start, end]
    this._listEl!.style.paddingTop = this.offset + 'px'
  }

  /** 滚动监测 */
  _observeScroll() {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(() => {
          ticking = false
          this._renderList()
        })
      }
    };

    this._container.addEventListener("scroll", onScroll)
    return {
      _dispose: () => {
        this._container.removeEventListener("scroll", onScroll)
      }
    }
  }

  _clear() {
    const [start, end] = this._range
    this._remove(start, end)
    this._range = [0, 0]
    this._listEl!.style.height = this.listHeight + 'px'
    this._listEl!.style.paddingTop = '0'
    this._container.scrollTop = 0
  }

  /** 更新 */
  update(itemCount: number) {
    if (!this._scroller) {
      return
    }
    this._itemCount = itemCount
    this._clear()
    this._renderList()
  }

  dispose() {
    if (this._scroller) {
      this._scroller._dispose()
      this._scroller = null
    }
    this._clear()
  }
}
