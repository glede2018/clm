Component({
  properties: {
    visible: { type: Boolean, value: false },
    step: { type: Number, value: 1 },
    total: { type: Number, value: 3 },
    title: { type: String, value: '' },
    description: { type: String, value: '' },
    targetHint: { type: String, value: '' },
    targetStyle: { type: String, value: '' },
    tooltipStyle: { type: String, value: '' },
    placement: { type: String, value: 'below' },
    actionText: { type: String, value: '' },
  },

  methods: {
    skip() { this.triggerEvent('skip') },
    next() { this.triggerEvent('next') },
  },
})
