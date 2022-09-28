<template>
  <span @click="doCallback">
    <v-icon v-for="item in parents" v-bind:key="item" color="transparent">person</v-icon>
    <v-icon v-if="expanded && hasChildren" >expand_more</v-icon>
    <v-icon v-if="!expanded && hasChildren">chevron_right</v-icon>
    <v-icon v-if="!hasChildren" color="transparent">person</v-icon>
    <span>{{ text }}</span>
  </span>
</template>

<script>

export default {
  name: 'ExpanderCell',
  data () {
    return {
      parents: [],
      path: '',
      callback: undefined,
      expanded: true,
      hasChildren: true,
      text: ''
    };
  },
  methods:{
    doCallback: function() {
      this.expanded = !this.expanded;
      this.callback(this.expanded, this.path + '|');
    }
  },
  beforeMount() {
    this.parents = this.params.value.parents;
    this.path = this.params.value.path;
    this.text = this.params.value.text;
    this.callback = this.params.callback;
    this.expanded = !this.params.collapsedNodes.includes(this.path + '|')
    this.hasChildren = this.params.value.children && this.params.value.children.length > 0;
  },
};

</script>