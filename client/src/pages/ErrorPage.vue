<template>
  <v-alert v-if="loaded" icon="error" prominent outlined type="error">
    {{ message }}
  </v-alert>
</template>

<script>
export default {
  name: 'ErrorPage',
  data () {
    return {
      message: 'Der Server ist leider offline. Versuche es in wenigen Momenten nochmal.',
      loaded: false
    }
  },
  created() {
    if (this.$route.query.type === 'unauthorized') {
      this.message = 'Du hast leider keine Berechtigungen für den Zugriff auf ' + this.$route.query.appName + '. Wenn du mit dem falschen Account eingeloggt bist, logge dich aus und versuche es erneut.'
    }
    this.loaded = true;
  }
}
</script>
