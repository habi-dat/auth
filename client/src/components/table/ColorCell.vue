<template>
  <span>
    <v-icon :color="color">square</v-icon>
    {{ color }}
  </span>
</template>

<script>

export default {
  name: 'ColorCell',
  computed: {
    color() {
      const { params } = this
      return '#' + params.value;
    }  
  }
};

</script>