'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative h-[60vh] w-full">
        <div className="absolute inset-0 bg-gray-900/50" />
        <Image
          src="/images/about/hero.jpg"
          alt="SAKO-OR Showroom"
          width={1920}
          height={1080}
          className="h-full w-full object-cover"
          priority
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-light text-white tracking-wide">
              Our Story
            </h1>
            <p className="mt-4 text-lg text-gray-200 max-w-2xl mx-auto">
              Crafting timeless elegance through exceptional footwear
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Our Heritage */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-light text-gray-900 mb-6">
                Our Heritage
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Founded with a passion for craftsmanship and an eye for timeless design, 
                SAKO-OR has been creating exceptional footwear since our inception. 
                Our journey began with a simple belief: that every step should be taken 
                in comfort and style.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Today, we continue to honor this tradition, combining traditional 
                shoemaking techniques with modern innovation to create pieces that 
                stand the test of time.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative h-[400px]"
            >
              <Image
                src="/images/about/heritage.jpg"
                alt="SAKO-OR Heritage"
                fill
                className="object-cover rounded-lg"
              />
            </motion.div>
          </div>
        </section>

        {/* Craftsmanship */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative h-[400px] md:order-2"
            >
              <Image
                src="/images/about/craftsmanship.jpg"
                alt="SAKO-OR Craftsmanship"
                fill
                className="object-cover rounded-lg"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="md:order-1"
            >
              <h2 className="text-3xl font-light text-gray-900 mb-6">
                Craftsmanship
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Each pair of SAKO-OR shoes is a testament to our commitment to 
                quality and attention to detail. Our skilled artisans combine 
                time-honored techniques with contemporary design to create footwear 
                that is both beautiful and functional.
              </p>
              <p className="text-gray-600 leading-relaxed">
                From the selection of premium materials to the final stitch, 
                every step in our process is executed with precision and care, 
                ensuring that each piece meets our exacting standards.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Values */}
        <section className="mb-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-light text-gray-900 mb-6">
              Our Values
            </h2>
            <p className="text-gray-600 max-w-3xl mx-auto">
              At SAKO-OR, we believe in creating more than just shoes. 
              We create experiences, memories, and lasting impressions.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Quality',
                description: 'We never compromise on the quality of our materials or craftsmanship.',
                icon: '✨'
              },
              {
                title: 'Sustainability',
                description: 'We are committed to responsible sourcing and sustainable practices.',
                icon: '🌱'
              },
              {
                title: 'Innovation',
                description: 'We continuously evolve while staying true to our heritage.',
                icon: '💡'
              }
            ].map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="text-center p-6"
              >
                <div className="text-4xl mb-4">{value.icon}</div>
                <h3 className="text-xl font-light text-gray-900 mb-3">
                  {value.title}
                </h3>
                <p className="text-gray-600">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section>
          <div className="text-center mb-16">
            <h2 className="text-3xl font-light text-gray-900 mb-6">
              Meet Our Team
            </h2>
            <p className="text-gray-600 max-w-3xl mx-auto">
              Behind every SAKO-OR creation is a team of passionate individuals 
              dedicated to excellence in design and craftsmanship.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                name: 'Moshe Sharabani',
                role: 'CEO & Founder',
                image: '/images/about/team-1.jpg'
              },
              {
                name: 'Avshi Sharabani',
                role: 'General Manager',
                image: '/images/about/team-2.jpg'
              }
            ].map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="relative h-[400px] mb-6 group">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900/20 rounded-lg" />
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover rounded-lg transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 border-2 border-white/20 rounded-lg" />
                </div>
                <h3 className="text-xl font-light text-gray-900 mb-2">
                  {member.name}
                </h3>
                <p className="text-gray-600">
                  {member.role}
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
} 