type StubScreenProps = {
  title: string
}

export function StubScreen({ title }: StubScreenProps) {
  return (
    <section className='screen'>
      <h1 className='screen-title'>{title}</h1>
      <p className='screen-subtitle'>Screen foundation is ready for the next build step.</p>
    </section>
  )
}
